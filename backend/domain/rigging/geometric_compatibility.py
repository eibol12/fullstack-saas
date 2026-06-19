"""Public stub of the rigging geometric-compatibility checker.

The pin/eye/bow fit-up compatibility rules (intellectual property) have been
removed from the public version. The class below is an inert placeholder that
reports everything as compatible. It is not used by the stubbed design engine.

See ``domain/STUB_NOTICE.md`` for details.
"""

from typing import Any, Dict


class RiggingGeometryChecker:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    def check_compatibility(self, components_data: Dict) -> Dict[str, Any]:
        return {"overall_compatible": True, "compatibility_details": []}

    def check(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        return {"overall_compatible": True, "compatibility_details": []}
