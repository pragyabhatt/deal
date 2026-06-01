import datetime
import io
import math
import numpy as np
import soundfile as sf
import librosa
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, desc
from typing import Optional

from app.config import settings
from app.database import engine, Base, get_db, AsyncSessionLocal
from app.models import User, Run, ActiveSession
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
    require_analyst,
    require_supervisor,
    require_admin,
    refresh_jwt_key_cache,
    decode_token
)
from app.audit import setup_audit_triggers, log_event
from app.kpi import mix_audio_at_snr, compute_kpis
from app.enhancement_router import router as enhancement_router
from app.transcription_router import router as transcription_router
from app.enhancement_model import EnhancementRun

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Secure audio metrics calculations for DRDO air-gapped environments.",
    version="1.0.0"
)

# ----------------- AUDIT LOG MIDDLEWARE -----------------
class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # We only log requests going to /api
        if not request.url.path.startswith("/api"):
            return await call_next(request)
            
        client_ip = request.client.host if request.client else "unknown"
        
        # Try to extract the user's username
        username = "anonymous"
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = decode_token(token)
                username = payload.get("sub", "anonymous")
            except Exception:
                pass
                
        event_type = f"ATTEMPT_{request.method}"
        resource = request.url.path
        
        # Log attempt
        async with AsyncSessionLocal() as db_session:
            try:
                await log_event(
                    db=db_session,
                    event_type=event_type,
                    username=username,
                    ip_address=client_ip,
                    resource=resource
                )
            except Exception as e:
                print(f"[AUDIT ERROR] Failed to log attempt: {e}")
                
        # Call next handler
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            # Log backend crash
            async with AsyncSessionLocal() as db_session:
                try:
                    await log_event(
                        db=db_session,
                        event_type="SERVER_CRASH",
                        username=username,
                        ip_address=client_ip,
                        resource=f"{resource} | Error: {str(e)[:100]}"
                    )
                except Exception:
                    pass
            raise e
            
        # Log outcome
        event_outcome = "SUCCESS" if status_code < 400 else f"CLIENT_ERROR_{status_code}" if status_code < 500 else "SERVER_ERROR"
        async with AsyncSessionLocal() as db_session:
            try:
                await log_event(
                    db=db_session,
                    event_type=event_outcome,
                    username=username,
                    ip_address=client_ip,
                    resource=f"{resource} | Status: {status_code}"
                )
            except Exception as e:
                print(f"[AUDIT ERROR] Failed to log outcome: {e}")
                
        return response

app.add_middleware(AuditLogMiddleware)

# Enable CORS for React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restructured by NGINX in production, allowed * for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register reverse-pipeline API routers
app.include_router(enhancement_router)
app.include_router(transcription_router)

@app.on_event("startup")
async def startup_event():
    """Create database tables, seed default users, register triggers and caches on startup."""
    async with engine.begin() as conn:
        # Create all tables async
        await conn.run_sync(Base.metadata.create_all)
        # Register audit immutability triggers
        await setup_audit_triggers(conn)
    
    # Seed default roles if users table is empty
    async with AsyncSession(engine) as session:
        # Seed JWT Key and refresh in-memory cache
        await refresh_jwt_key_cache(session)
        
        result = await session.execute(select(func.count(User.id)))
        count = result.scalar()
        if count == 0:
            print("Seeding database with default accounts...")
            admin_user = User(
                username="pragya",
                hashed_password=hash_password("deal@123"),
                role="admin"
            )
            supervisor_user = User(
                username="supervisor",
                hashed_password=hash_password("supervisor123"),
                role="supervisor"
            )
            analyst_user = User(
                username="analyst",
                hashed_password=hash_password("analyst123"),
                role="analyst"
            )
            session.add_all([admin_user, supervisor_user, analyst_user])
            await session.commit()
            print("Seeding completed successfully!")

# ----------------- AUTHENTICATION API -----------------

@app.post("/api/auth/login")
async def login(
    username: str = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user and issue high-security access & refresh tokens."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = create_access_token(data={"sub": user.username})
    refresh_token = create_refresh_token(data={"sub": user.username})
    
    # Store token in active sessions
    expiry = datetime.datetime.utcnow() + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    active_session = ActiveSession(user_id=user.id, token=refresh_token, expires_at=expiry)
    db.add(active_session)
    await db.commit()
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role
    }

@app.post("/api/auth/refresh")
async def refresh_token(
    refresh_token: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Validate refresh token and issue a fresh 15-minute access token."""
    # Check if session exists in DB
    result = await db.execute(select(ActiveSession).where(ActiveSession.token == refresh_token))
    session_record = result.scalars().first()
    if not session_record or session_record.expires_at < datetime.datetime.utcnow():
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
        
    try:
        from jose import jwt
        payload = jwt.decode(refresh_token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if username is None or token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except Exception:
         raise HTTPException(status_code=401, detail="Invalid refresh token")
         
    # Query user
    user_res = await db.execute(select(User).where(User.username == username))
    user = user_res.scalars().first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    # Generate new access token
    new_access = create_access_token(data={"sub": user.username})
    return {
        "access_token": new_access,
        "token_type": "bearer"
    }

@app.post("/api/auth/logout")
async def logout(
    refresh_token: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Revoke session and invalidate refresh token."""
    result = await db.execute(select(ActiveSession).where(ActiveSession.token == refresh_token))
    session_record = result.scalars().first()
    if session_record:
        await db.delete(session_record)
        await db.commit()
    return {"detail": "Logged out successfully"}

# ----------------- AUDIO KPI PROCESSING -----------------

@app.post("/api/analysis/run")
async def run_audio_analysis(
    clean_file: UploadFile = File(...),
    noise_type: str = Form(...),
    snr_db: float = Form(...),
    project_id: Optional[int] = Form(None),
    force_run: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """
    Perform SNR, PESQ, STOI, and reference-free DNSMOS speech quality calculations.
    Includes rate limiting, project scoping, duplicate checks, and windowed spectrographs.
    """
    from app.auth import check_rate_limit
    from app.models import ProjectMembership
    from app.kpi import compute_dnsmos
    from sqlalchemy import delete
    import hashlib
    
    # 1. Enforce per-user hourly rate limits
    check_rate_limit(current_user)
    
    # 2. Scoped Project validation
    if current_user.role != "admin":
        pm_res = await db.execute(select(ProjectMembership).where(ProjectMembership.user_id == current_user.id))
        user_projects = [m.project_id for m in pm_res.scalars().all()]
        if project_id:
            if project_id not in user_projects:
                raise HTTPException(status_code=403, detail="Access to specified project is forbidden.")
            assigned_project_id = project_id
        else:
            if not user_projects:
                raise HTTPException(status_code=403, detail="You must belong to at least one project to run analysis.")
            assigned_project_id = user_projects[0]
    else:
        assigned_project_id = project_id
        
    # 3. Read clean audio input file
    file_bytes = await clean_file.read()
    
    # Calculate SHA-256 raw file integrity hash
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    
    # 4. Duplicate Check
    if not force_run:
        dup_res = await db.execute(select(Run).where(Run.file_hash == file_hash))
        dup_run = dup_res.scalars().first()
        if dup_run:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "This file was previously analyzed.",
                    "run_id": dup_run.id,
                    "clean_file_name": dup_run.clean_file_name,
                    "date": dup_run.timestamp.isoformat(),
                    "pesq_score": dup_run.pesq_score,
                    "stoi_score": dup_run.stoi_score,
                    "final_snr": dup_run.final_snr
                }
            )
    else:
        # Clear existing unique constraint run if forced
        await db.execute(delete(Run).where(Run.file_hash == file_hash))
        await db.commit()
        
    try:
        # Load audio using soundfile safely
        audio_io = io.BytesIO(file_bytes)
        clean_data, fs = sf.read(audio_io)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid audio format. Please upload a standard WAV file. Error: {str(e)}"
        )
        
    # Standardize multi-channel audio to mono
    if len(clean_data.shape) > 1:
        clean_data = np.mean(clean_data, axis=1)
        
    # 5. Mix with selected noise type at selected SNR
    mixed_data, scaled_noise, actual_snr = mix_audio_at_snr(clean_data, noise_type, snr_db, fs)
    
    # 6. Compute Quality Assessment KPIs + DNSMOS reference-free subscores
    snr_val, pesq_val, stoi_val = compute_kpis(clean_data, mixed_data, fs, noise_type, snr_db)
    sig_mos, bak_mos, ovr_mos = compute_dnsmos(mixed_data, fs)
    
    # 7. Downsample waveforms for highly optimized UI rendering (e.g. 400 peaks)
    max_peaks = 400
    step = max(1, len(clean_data) // max_peaks)
    clean_peaks = [float(np.max(np.abs(clean_data[i:i+step]))) for i in range(0, len(clean_data), step)][:max_peaks]
    mixed_peaks = [float(np.max(np.abs(mixed_data[i:i+step]))) for i in range(0, len(mixed_data), step)][:max_peaks]
    
    # 8. Memory-optimized Windowed Spectrogram Generation
    # If audio is extremely long, slide/decimate to maximum of 160,000 samples (10s at 16kHz)
    max_samples = 160000
    spec_data = clean_data
    if len(clean_data) > max_samples:
        ds_step = len(clean_data) // max_samples
        spec_data = clean_data[::ds_step]
        
    stft_matrix = np.abs(librosa.stft(spec_data, n_fft=512, hop_length=256))
    stft_db = librosa.amplitude_to_db(stft_matrix, ref=np.max)
    
    # Downsample matrix dimensions to 80 time steps x 40 frequency bands
    spectrogram_height = 40
    spectrogram_width = 80
    freq_indices = np.linspace(0, stft_db.shape[0] - 1, spectrogram_height, dtype=int)
    time_indices = np.linspace(0, stft_db.shape[1] - 1, spectrogram_width, dtype=int)
    compact_spec = stft_db[freq_indices, :][:, time_indices]
    
    # Normalize spectrogram
    min_db, max_db = np.min(compact_spec), np.max(compact_spec)
    db_range = max_db - min_db if max_db > min_db else 1.0
    normalized_spec = ((compact_spec - min_db) / db_range).tolist()
    
    # 9. Save Run record in DB for audit trail
    run_record = Run(
        analyst_id=current_user.id,
        analyst_username=current_user.username,
        clean_file_name=clean_file.filename,
        noise_type=noise_type,
        snr_db=snr_db,
        pesq_score=round(pesq_val, 3),
        stoi_score=round(stoi_val, 3),
        final_snr=round(snr_val, 2),
        file_hash=file_hash,
        project_id=assigned_project_id,
        dnsmos_sig=sig_mos,
        dnsmos_bak=bak_mos,
        dnsmos_ovr=ovr_mos
    )
    db.add(run_record)
    await db.commit()
    
    return {
        "id": run_record.id,
        "clean_file_name": clean_file.filename,
        "noise_type": noise_type,
        "snr_db": snr_db,
        "pesq_score": round(pesq_val, 3),
        "stoi_score": round(stoi_val, 3),
        "final_snr": round(snr_val, 2),
        "fs": fs,
        "duration": float(len(clean_data) / fs),
        "file_hash": file_hash,
        "project_id": assigned_project_id,
        "dnsmos_sig": sig_mos,
        "dnsmos_bak": bak_mos,
        "dnsmos_ovr": ovr_mos,
        "clean_waveform": clean_peaks,
        "mixed_waveform": mixed_peaks,
        "spectrogram": normalized_spec
    }

# ----------------- SUPERVISOR RUN AUDITS -----------------

@app.get("/api/analysis/runs")
async def get_all_runs(
    analyst_username: Optional[str] = None,
    noise_type: Optional[str] = None,
    min_snr: Optional[float] = None,
    max_snr: Optional[float] = None,
    project_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor)
):
    """Retrieve audit history logs of all metrics runs. Enforces Project Membership Isolation."""
    from app.models import ProjectMembership
    query = select(Run)
    
    # Enforce data isolation filtering
    if current_user.role != "admin":
        pm_res = await db.execute(select(ProjectMembership).where(ProjectMembership.user_id == current_user.id))
        user_projects = [m.project_id for m in pm_res.scalars().all()]
        query = query.where(Run.project_id.in_(user_projects))
        if project_id and project_id not in user_projects:
            raise HTTPException(status_code=403, detail="Access denied to requested project scope.")
    elif project_id:
        query = query.where(Run.project_id == project_id)
        
    # Apply supervisors filters
    if analyst_username:
        query = query.where(Run.analyst_username.like(f"%{analyst_username}%"))
    if noise_type and noise_type != "All":
        query = query.where(Run.noise_type == noise_type.lower())
    if min_snr is not None:
        query = query.where(Run.snr_db >= min_snr)
    if max_snr is not None:
        query = query.where(Run.snr_db <= max_snr)
        
    # Get total count before limits
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total_count = count_result.scalar()
    
    # Order by newest first
    query = query.order_by(desc(Run.timestamp)).limit(limit).offset(offset)
    result = await db.execute(query)
    runs = result.scalars().all()
    
    return {
        "total": total_count,
        "runs": [
            {
                "id": r.id,
                "analyst_username": r.analyst_username,
                "clean_file_name": r.clean_file_name,
                "noise_type": r.noise_type,
                "snr_db": r.snr_db,
                "pesq_score": r.pesq_score,
                "stoi_score": r.stoi_score,
                "final_snr": r.final_snr,
                "timestamp": r.timestamp.isoformat()
            } for r in runs
        ]
    }

# ----------------- ADMIN USER MANAGEMENT -----------------

@app.get("/api/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List all accounts inside the local DEAL directory."""
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "created_at": u.created_at.isoformat()
        } for u in users
    ]

@app.post("/api/users")
async def create_user(
    username: str = Form(...),
    password: str = Form(...),
    role: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Provision a new security credential account."""
    if role not in ["analyst", "supervisor", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")
        
    # Check if username exists
    existing = await db.execute(select(User).where(User.username == username))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Username already exists")
        
    new_user = User(
        username=username,
        hashed_password=hash_password(password),
        role=role
    )
    db.add(new_user)
    await db.commit()
    return {
        "id": new_user.id,
        "username": new_user.username,
        "role": new_user.role,
        "detail": "User created successfully"
    }

@app.put("/api/users/{user_id}")
async def update_user(
    user_id: int,
    username: str = Form(...),
    password: Optional[str] = Form(None),
    role: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Modify details or rotate credentials for an account."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if role not in ["analyst", "supervisor", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")
        
    # Prevent admin from changing their own role to something else
    if user.id == current_user.id and role != "admin":
        raise HTTPException(status_code=400, detail="Cannot demote yourself from admin")
        
    user.username = username
    user.role = role
    if password:
        user.hashed_password = hash_password(password)
        
    await db.commit()
    return {"detail": "User updated successfully"}

@app.delete("/api/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Deprovision and revoke access for a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your active admin account")
        
    await db.delete(user)
    await db.commit()
    return {"detail": "User deleted successfully"}

@app.post("/api/auth/rotate-keys")
async def rotate_jwt_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Admin-only endpoint to rotate the active JWT signing key on demand."""
    import secrets
    new_secret = secrets.token_hex(32)
    
    result = await db.execute(select(func.max(JwtKey.version)))
    max_ver = result.scalar() or 0
    new_ver = max_ver + 1
    
    new_key = JwtKey(version=new_ver, secret=new_secret)
    db.add(new_key)
    await db.commit()
    
    await refresh_jwt_key_cache(db)
    
    await log_event(
        db=db,
        event_type="KEY_ROTATION",
        username=current_user.username,
        resource=f"Rotated JWT key to version {new_ver}"
    )
    
    return {"detail": f"JWT signing key rotated successfully to version {new_ver}"}
