import os

class Settings:
    PROJECT_NAME: str = "DEAL Audio Quality Assessment Dashboard"
    
    # Security Configurations
    # In production, this should be a strong random secret loaded from environment
    JWT_SECRET: str = os.getenv("JWT_SECRET", "7f92a95e63b6510f277189f7833075c3efcd6a8d6b9e2491a62d04a625a6f23c")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database Configurations
    # Fallback to local SQLite file database inside the backend folder for easy local testing
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "deal_dashboard")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    
    @property
    def DATABASE_URL(self) -> str:
        # Check if we are running inside Docker or have a PostgreSQL host set
        # If not, fallback to local SQLite database
        docker_state = os.getenv("RUNNING_IN_DOCKER", "false").lower() == "true"
        if docker_state or os.getenv("POSTGRES_HOST"):
            return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        else:
            # Local SQLite fallback
            return "sqlite+aiosqlite:///./deal_dashboard.db"

settings = Settings()
