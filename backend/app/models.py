import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="analyst")  # analyst, supervisor, admin
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    runs = relationship("Run", back_populates="analyst", cascade="all, delete-orphan")
    memberships = relationship("ProjectMembership", back_populates="user", cascade="all, delete-orphan")

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    memberships = relationship("ProjectMembership", back_populates="project", cascade="all, delete-orphan")

class ProjectMembership(Base):
    __tablename__ = "project_memberships"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False) # 'analyst', 'supervisor'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    project = relationship("Project", back_populates="memberships")
    user = relationship("User", back_populates="memberships")

class Run(Base):
    __tablename__ = "runs"
    
    id = Column(Integer, primary_key=True, index=True)
    analyst_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    analyst_username = Column(String, nullable=False) # Copied for denormalized search & simplicity
    clean_file_name = Column(String, nullable=False)
    noise_type = Column(String, nullable=False) # white, pink, babble, factory
    snr_db = Column(Float, nullable=False) # Configured SNR target slider value
    
    # Computed KPI Scores
    pesq_score = Column(Float, nullable=True) # PESQ MOS score
    stoi_score = Column(Float, nullable=True) # STOI index
    final_snr = Column(Float, nullable=True)  # Calculated actual post-mix SNR
    
    # New integrity and isolation fields
    file_hash = Column(String, unique=True, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    batch_id = Column(Integer, ForeignKey("batch_runs.id", ondelete="SET NULL"), nullable=True)
    
    # DNSMOS subscores
    dnsmos_sig = Column(Float, nullable=True)
    dnsmos_bak = Column(Float, nullable=True)
    dnsmos_ovr = Column(Float, nullable=True)
    
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationship
    analyst = relationship("User", back_populates="runs")

class ActiveSession(Base):
    """Optional database-level active sessions storage for logging in/out audit checks."""
    __tablename__ = "active_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class JwtKey(Base):
    __tablename__ = "jwt_keys"
    version = Column(Integer, primary_key=True)
    secret = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False)
    username = Column(String, nullable=False)
    user_id = Column(Integer, nullable=True)
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    resource = Column(String, nullable=True)
    previous_hash = Column(String, nullable=True)
    record_hash = Column(String, nullable=False)

class NoiseProfile(Base):
    __tablename__ = "noise_profiles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, nullable=False) # atmospheric, electronic, babble, jamming, mechanical
    filepath = Column(String, nullable=False)
    file_hash = Column(String, nullable=False)
    analyst_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class BatchRun(Base):
    __tablename__ = "batch_runs"
    id = Column(Integer, primary_key=True, index=True)
    analyst_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="queued") # queued, processing, completed, partially_failed
    noise_type = Column(String, nullable=True)
    snr_db = Column(Float, nullable=True)
    enhancement_method = Column(String, nullable=True)
    total_files = Column(Integer, default=0)
    completed_files = Column(Integer, default=0)
    failed_files = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

