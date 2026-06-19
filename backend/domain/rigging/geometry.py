"""Public stub of rigging geometry helpers.

The sling-length geometry derivation (intellectual property) has been removed
from the public version. ``compute_sling_lengths`` returns a fixed placeholder
length per lifting point so callers receive a shape-valid result.

See ``domain/STUB_NOTICE.md`` for details.
"""

from typing import Any, Dict, List

_PLACEHOLDER_SLING_LENGTH: float = 5.0


def compute_sling_lengths(configuration: Dict[str, Any], lifting_points_qty: int) -> List[float]:
    try:
        qty = int(lifting_points_qty or 1)
    except (TypeError, ValueError):
        qty = 1
    return [_PLACEHOLDER_SLING_LENGTH] * max(1, qty)
