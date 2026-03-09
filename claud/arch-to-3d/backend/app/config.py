import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
CORS_ORIGINS = ["http://localhost:5173"]
JWC_CONVERTER_COMMAND = os.getenv("JWC_CONVERTER_COMMAND", "").strip()
