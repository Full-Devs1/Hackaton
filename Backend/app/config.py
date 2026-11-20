from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/ecoconecta"
    JWT_SECRET_KEY: str = "cambiar_esta_clave_en_produccion"
    JWT_ALGORITHM: str = "HS256"
    CORS_ORIGINS: str = "*"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()