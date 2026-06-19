from enum import Enum
from typing import Set

try:
    # Optionally allow override from Django settings
    from django.conf import settings
    VALID_LOCATIONS: Set[str] = set(getattr(settings, 'LIFTING_VALID_LOCATIONS', {"inshore", "offshore", "subsea", "onshore"}))
    ALLOWED_LIFTING_POINTS: Set[int] = set(getattr(settings, 'LIFTING_ALLOWED_POINTS', {1, 2, 3, 4}))
except Exception:
    # Fallback values if settings not available (e.g., during import in scripts)
    VALID_LOCATIONS = {"inshore", "offshore", "subsea", "onshore"}
    ALLOWED_LIFTING_POINTS = {1, 2, 3, 4}


class ExportFormat(str, Enum):
    JSON = "json"
    CSV = "csv"
    PDF = "pdf"
