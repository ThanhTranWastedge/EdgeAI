from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret_key: str
    admin_username: str = "admin"
    admin_password: str = ""
    database_url: str = "sqlite+aiosqlite:///data/edgeai.db"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    model_config = {"env_file": ".env"}


settings = Settings()
