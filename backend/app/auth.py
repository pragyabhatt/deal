import datetime
import uuid
from typing import Optional, List, Dict
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User, JwtKey

# Password hashing configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# FastAPI standard bearer token handler
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# In-memory JWT keys cache to keep sync functions non-blocking
jwt_key_cache: Dict[int, str] = {1: settings.JWT_SECRET}
active_key_version: int = 1

# In-memory tracker for session inactivity: sid -> last_active_time (datetime)
session_activity_tracker: Dict[str, datetime.datetime] = {}

async def refresh_jwt_key_cache(db: AsyncSession):
    """Seed key version 1 if table is empty, and sync the in-memory cache."""
    global jwt_key_cache, active_key_version
    result = await db.execute(select(JwtKey).order_by(JwtKey.version))
    keys = result.scalars().all()
    if not keys:
        # Seed default key
        default_secret = settings.JWT_SECRET
        db_key = JwtKey(version=1, secret=default_secret)
        db.add(db_key)
        await db.commit()
        keys = [db_key]
    
    jwt_key_cache.clear()
    for k in keys:
        jwt_key_cache[k.version] = k.secret
    active_key_version = max(jwt_key_cache.keys())

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify standard text password against hash."""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    """Create access token with active key version and version field in header/payload."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    version = active_key_version
    secret = jwt_key_cache.get(version, settings.JWT_SECRET)
    
    # Generate a unique sid if not provided to track session timeout
    if "sid" not in to_encode:
        to_encode["sid"] = str(uuid.uuid4())
        
    to_encode.update({"exp": expire, "type": "access", "kid": version})
    encoded_jwt = jwt.encode(to_encode, secret, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    """Create refresh token with active key version and version field in header/payload."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    version = active_key_version
    secret = jwt_key_cache.get(version, settings.JWT_SECRET)
    
    if "sid" not in to_encode:
        to_encode["sid"] = str(uuid.uuid4())
        
    to_encode.update({"exp": expire, "type": "refresh", "kid": version})
    encoded_jwt = jwt.encode(to_encode, secret, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict:
    """Decode token using the matching rotated key version."""
    try:
        # First decode without signature verification to extract the key version (kid)
        unverified = jwt.decode(token, options={"verify_signature": False})
        kid = unverified.get("kid", 1)
    except Exception:
        raise JWTError("Invalid token structure")
        
    secret = jwt_key_cache.get(kid, settings.JWT_SECRET)
    payload = jwt.decode(token, secret, algorithms=[settings.ALGORITHM])
    return payload

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    """Validate current access JWT token and extract the active user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        session_id: str = payload.get("sid")
        
        if username is None or token_type != "access" or session_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
        
    # Check session inactivity
    now = datetime.datetime.utcnow()
    last_active = session_activity_tracker.get(session_id)
    if last_active:
        threshold_minutes = 10 if user.role == "admin" else 15
        elapsed_minutes = (now - last_active).total_seconds() / 60.0
        if elapsed_minutes > threshold_minutes:
            session_activity_tracker.pop(session_id, None)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired due to inactivity",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
    # Update/set session last active time
    session_activity_tracker[session_id] = now
    
    return user

class RoleChecker:
    """RBAC checks for role authorization control."""
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action forbidden. Required roles: {self.allowed_roles}. Current role: {current_user.role}"
            )
        return current_user

# Predefined role helpers
require_analyst = RoleChecker(["analyst", "supervisor", "admin"])
require_supervisor = RoleChecker(["supervisor", "admin"])
require_admin = RoleChecker(["admin"])

# In-memory request rate tracker: user_id -> list of datetime timestamps
rate_limit_tracker: Dict[int, List[datetime.datetime]] = {}

def check_rate_limit(user: User):
    """Enforces hourly request limits per analyst (50 runs/hr) and supervisor (150 runs/hr)."""
    if user.role == "admin":
        return
        
    now = datetime.datetime.utcnow()
    timestamps = rate_limit_tracker.setdefault(user.id, [])
    
    # Prune runs older than 1 hour
    one_hour_ago = now - datetime.timedelta(hours=1)
    timestamps = [t for t in timestamps if t > one_hour_ago]
    rate_limit_tracker[user.id] = timestamps
    
    limit = 50 if user.role == "analyst" else 150
    if len(timestamps) >= limit:
        reset_time = timestamps[0] + datetime.timedelta(hours=1)
        retry_after = int((reset_time - now).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Hourly rate limit exceeded. You have processed {limit} runs in the last hour. Please try again in {retry_after} seconds."
        )
        
    timestamps.append(now)
