from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    bff_url: str = "http://localhost:3000"
    supabase_url: str
    supabase_service_role_key: str


settings = Settings()  # type: ignore[call-arg]
