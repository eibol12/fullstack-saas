"""Public stub of the rigging arrangement resolver.

The arrangement-determination logic (intellectual property) has been removed
from the public version. The class below produces a fixed, generic arrangement
(one top masterlink plus a Shackle/WireRope pair per lifting point).

See ``domain/STUB_NOTICE.md`` for details.
"""

from typing import Any, List, Optional


class RiggingArrangement:
    def __init__(
        self,
        lifting_points_qty: int = 0,
        user_arrangement: Optional[List[str]] = None,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        self.lifting_points_qty = lifting_points_qty
        self.user_arrangement = user_arrangement or []

    def determine_arrangement(self) -> List[str]:
        if self.user_arrangement:
            return list(self.user_arrangement)
        try:
            qty = int(self.lifting_points_qty or 1)
        except (TypeError, ValueError):
            qty = 1
        arrangement: List[str] = ["Masterlink"]
        for _ in range(max(1, qty)):
            arrangement.extend(["Shackle", "WireRope"])
        return arrangement
