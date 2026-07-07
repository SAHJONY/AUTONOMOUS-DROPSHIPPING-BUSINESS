from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Claude Commerce OS"
    environment: str = "development"

    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60 * 24

    database_url: str = "sqlite:///./commerce_os.db"

    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-opus-4-8"
    agent_max_iterations: int = 12
    agent_max_tokens: int = 16000

    launch_score_threshold: float = 85.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
