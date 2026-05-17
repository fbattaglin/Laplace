from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Laplace"
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:5173"]
    data_dir: Path = Path(__file__).parent / "data" / "preloaded"

    model_config = {"env_prefix": "LAPLACE_"}


settings = Settings()
