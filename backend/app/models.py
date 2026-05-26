import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
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
