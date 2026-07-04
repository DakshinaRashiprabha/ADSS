import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://dss_user:dss_password@localhost:5433/ampara_dss",
)

_csv = os.getenv("CSV_PATH", "../An_Automated_Decision_Support_System_For_Analyzing_And_Optimizing.csv")
CSV_PATH = (BASE_DIR / _csv).resolve() if not os.path.isabs(_csv) else Path(_csv)

GOOGLE_SHEET_CSV_URL = os.getenv("GOOGLE_SHEET_CSV_URL", "").strip()
SYNC_INTERVAL_MINUTES = int(os.getenv("SYNC_INTERVAL_MINUTES", "0") or 0)

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
