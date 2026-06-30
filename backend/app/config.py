import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    
    # Port & Host
    PORT: int = 8000
    HOST: str = "127.0.0.1"

    # Use SQLite Mock DB if Supabase URL/Key is not set
    @property
    def USE_MOCK_DB(self) -> bool:
        return not self.SUPABASE_URL or not self.SUPABASE_ANON_KEY

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
