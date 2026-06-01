import datetime
import hashlib
from typing import Optional
from sqlalchemy import text
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuditLog

async def setup_audit_triggers(conn):
    """
    Setup database-level triggers to enforce audit_logs table immutability.
    Supports SQLite and PostgreSQL.
    """
    db_name = conn.dialect.name
    if db_name == "sqlite":
        # Create triggers to raise failure on update or delete
        await conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS audit_logs_no_update
            BEFORE UPDATE ON audit_logs
            BEGIN
                SELECT RAISE(FAIL, 'Audit logs are immutable. UPDATE operations are strictly forbidden.');
            END;
        """))
        await conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS audit_logs_no_delete
            BEFORE DELETE ON audit_logs
            BEGIN
                SELECT RAISE(FAIL, 'Audit logs are immutable. DELETE operations are strictly forbidden.');
            END;
        """))
    elif db_name == "postgresql":
        # Create plpgsql exception raising trigger
        await conn.execute(text("""
            CREATE OR REPLACE FUNCTION raise_audit_log_immutable_error()
            RETURNS TRIGGER AS $$
            BEGIN
                RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are strictly forbidden.';
            END;
            $$ LANGUAGE plpgsql;
        """))
        # Drop trigger if exists to recreate safely
        await conn.execute(text("DROP TRIGGER IF EXISTS enforce_audit_logs_immutability ON audit_logs;"))
        await conn.execute(text("""
            CREATE TRIGGER enforce_audit_logs_immutability
            BEFORE UPDATE OR DELETE ON audit_logs
            FOR EACH ROW
            EXECUTE FUNCTION raise_audit_log_immutable_error();
        """))

async def log_event(
    db: AsyncSession,
    event_type: str,
    username: str,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    resource: Optional[str] = None
) -> AuditLog:
    """
    Securely record a system event in the hash-chained AuditLog.
    Each record incorporates the hash of the preceding record, making deletion or alteration detectable.
    """
    # 1. Fetch previous record to build the chain
    result = await db.execute(select(AuditLog).order_by(AuditLog.id.desc()).limit(1))
    prev_record = result.scalars().first()
    
    if prev_record:
        previous_hash = prev_record.record_hash
    else:
        # Genesis hash (64 zeros)
        previous_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        
    timestamp = datetime.datetime.utcnow()
    
    # 2. Formulate input representation for current record hashing
    # Fields: event_type, username, user_id, ip_address, timestamp, resource, previous_hash
    payload = (
        f"{event_type}|"
        f"{username}|"
        f"{user_id if user_id is not None else ''}|"
        f"{ip_address if ip_address else ''}|"
        f"{timestamp.isoformat()}|"
        f"{resource if resource else ''}|"
        f"{previous_hash}"
    )
    
    record_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    
    # 3. Write row
    audit_entry = AuditLog(
        event_type=event_type,
        username=username,
        user_id=user_id,
        ip_address=ip_address,
        timestamp=timestamp,
        resource=resource,
        previous_hash=previous_hash,
        record_hash=record_hash
    )
    
    db.add(audit_entry)
    await db.commit()
    await db.refresh(audit_entry)
    return audit_entry
