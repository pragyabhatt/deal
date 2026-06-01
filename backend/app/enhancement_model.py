import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class EnhancementRun(Base):
    __tablename__ = "enhancement_runs"
    
    id = Column(Integer, primary_key=True, index=True)
    analyst_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    analyst_username = Column(String, nullable=False)
    uploaded_filename = Column(String, nullable=False)
    enhancement_method = Column(String, nullable=False) # fast, deep
    
    # Computed KPIs Before & After
    pesq_before = Column(Float, nullable=True)
    pesq_after = Column(Float, nullable=True)
    stoi_before = Column(Float, nullable=True)
    stoi_after = Column(Float, nullable=True)
    snr_improvement = Column(Float, nullable=True)
    wer_before = Column(Float, nullable=True)
    wer_after = Column(Float, nullable=True)
    
    # New security/isolation/DNSMOS fields
    file_hash = Column(String, unique=True, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    batch_id = Column(Integer, ForeignKey("batch_runs.id", ondelete="SET NULL"), nullable=True)
    
    dnsmos_sig = Column(Float, nullable=True)
    dnsmos_bak = Column(Float, nullable=True)
    dnsmos_ovr = Column(Float, nullable=True)
    
    transcript_text = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
