"""Environment configuration. Reads .env from the project dir (mcp/)."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# cwd first (uv run --directory mcp), then the package's project dir as fallback
load_dotenv()
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


@dataclass(frozen=True)
class Settings:
    db_url_app: str = os.environ.get(
        "RELOS_DB_URL_APP", "postgresql://relos_app:app@127.0.0.1:55432/relos"
    )
    db_url_auth: str = os.environ.get(
        "RELOS_DB_URL_AUTH", "postgresql://relos_auth:auth@127.0.0.1:55432/relos"
    )
    tenant_slug: str = os.environ.get("RELOS_TENANT_SLUG", "aurum")


settings = Settings()
