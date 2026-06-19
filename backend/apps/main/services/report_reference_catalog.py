from __future__ import annotations

from typing import Dict, Optional


REPORT_REFERENCE_CATALOG: Dict[str, Dict[str, str]] = {
    "1": {
        "id": "1",
        "title": "DNV-ST-N001 Marine Operations and Marine Warranty",
    },
}


def get_report_reference(reference_id: str | int | None) -> Optional[Dict[str, str]]:
    if reference_id is None:
        return None
    return REPORT_REFERENCE_CATALOG.get(str(reference_id))
