import datetime
import io
import math
import numpy as np
import soundfile as sf
import librosa
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, desc

from app.config import settings
from app.database import engine, Base, get_db
from app.models import User, Run, ActiveSession
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
    require_analyst,
    require_supervisor,
    require_admin
)
from app.kpi import mix_audio_at_snr, compute_kpis

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Secure audio metrics calculations for DRDO air-gapped environments.",
    version="1.0.0"
)

# Enable CORS for React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restructured by NGINX in production, allowed * for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Create database tables and seed default users on startup."""
    async with engine.begin() as conn:
        # Create all tables async
        await conn.run_sync(Base.metadata.create_all)
    
    # Seed default roles if users table is empty
    async with AsyncSession(engine) as session:
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """
    Perform SNR, PESQ, and STOI quality calculation.
    Automatically handles resampling on standard audio files using our safety layer.
    """
    # 1. Read clean audio input file
    file_bytes = await clean_file.read()
    
    try:
        # Load audio using soundfile
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
        
    # 2. Mix with selected noise type at selected SNR
    mixed_data, scaled_noise, actual_snr = mix_audio_at_snr(clean_data, noise_type, snr_db, fs)
    
    # 3. Compute Quality Assessment KPIs
    snr_val, pesq_val, stoi_val = compute_kpis(clean_data, mixed_data, fs, noise_type, snr_db)
    
    # 4. Downsample waveforms for highly optimized UI rendering (e.g. 400 peaks)
    max_peaks = 400
    step = max(1, len(clean_data) // max_peaks)
    
    # Downsample using peak envelope calculation
    clean_peaks = [float(np.max(np.abs(clean_data[i:i+step]))) for i in range(0, len(clean_data), step)][:max_peaks]
    mixed_peaks = [float(np.max(np.abs(mixed_data[i:i+step]))) for i in range(0, len(mixed_data), step)][:max_peaks]
    
    # 5. Generate high-fidelity compact spectrogram data for UI Canvas
    # Compute Short Time Fourier Transform (STFT)
    stft_matrix = np.abs(librosa.stft(clean_data, n_fft=512, hop_length=256))
    stft_db = librosa.amplitude_to_db(stft_matrix, ref=np.max)
    
    # Downsample matrix dimensions to 80 time steps x 40 frequency bands for highly compact JSON loading
    spectrogram_height = 40
    spectrogram_width = 80
    
    # Downsample along frequency (rows) and time (columns)
    freq_indices = np.linspace(0, stft_db.shape[0] - 1, spectrogram_height, dtype=int)
    time_indices = np.linspace(0, stft_db.shape[1] - 1, spectrogram_width, dtype=int)
    
    compact_spec = stft_db[freq_indices, :][:, time_indices]
    
    # Normalize spectrogram between 0.0 and 1.0 for rendering gradient maps
    min_db, max_db = np.min(compact_spec), np.max(compact_spec)
    db_range = max_db - min_db if max_db > min_db else 1.0
    normalized_spec = ((compact_spec - min_db) / db_range).tolist()
    
    # 6. Save Run record in DB for audit trail
    run_record = Run(
        analyst_id=current_user.id,
        analyst_username=current_user.username,
        clean_file_name=clean_file.filename,
        noise_type=noise_type,
        snr_db=snr_db,
        pesq_score=round(pesq_val, 3),
        stoi_score=round(stoi_val, 3),
        final_snr=round(snr_val, 2)
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
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor)
):
    """Retrieve audit history logs of all metrics runs. Filterable and sortable."""
    query = select(Run)
    
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
