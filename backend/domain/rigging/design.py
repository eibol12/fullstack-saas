"""Public stub of the rigging design engine.

This module is a PLACEHOLDER. The real component-selection, geometric
compatibility and utilization optimisation logic (the core intellectual
property of this project) has been removed from the public version.

``RiggingDesigner`` below keeps the public interface and the output shape that
the application layer (``apps.main.services.rigging`` / ``domain.rigging.engine``)
relies on, but it does NOT perform any real engineering selection. It returns a
fixed, generic-but-shape-valid arrangement so the full workflow (design →
persist → enrich → report) runs end to end. The selected components and
utilization figures are placeholders and are NOT engineering-valid.

See ``domain/STUB_NOTICE.md`` for details.
"""

import logging
from dataclasses import is_dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

import numpy as np

from domain.rigging import ports
from domain.rigging.errors import RiggingDesignError
from domain.rigging.resolve import resolve_user_preferences
from domain.rigging.types import RiggingAnalysisInput, UserPreferencesDTO

logger = logging.getLogger(__name__)


# --- JSON serialization helpers (not IP) -------------------------------------

def _ref_from_component(obj):
    ref = {
        "type": obj.__class__.__name__,
        "id": str(getattr(obj, "id", None)),
    }
    for k in ("manufacturer", "model", "working_load_limit", "nominal_diameter", "minimum_breaking_load"):
        v = getattr(obj, k, None)
        if v is not None:
            ref[k] = float(v) if isinstance(v, Decimal) else v
    return ref


def _model_to_ref(obj):
    if obj is None:
        return None
    if is_dataclass(obj):
        return _ref_from_component(obj)
    if hasattr(obj, "id") and any(
        hasattr(obj, k) for k in ("manufacturer", "model", "working_load_limit", "nominal_diameter")
    ):
        return _ref_from_component(obj)
    return None


def _json_safe(value):
    ref = _model_to_ref(value)
    if ref is not None:
        return ref

    if value is None or isinstance(value, (bool, int, float, str)):
        return value

    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, (np.integer, )):
        return int(value)
    if isinstance(value, (np.floating, )):
        return float(value)
    if isinstance(value, (np.ndarray, )):
        return [_json_safe(x) for x in value.tolist()]

    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]

    raise TypeError(f"Value of type {type(value).__name__} is not JSON-serializable")


# --- Fixed placeholder constants (NOT engineering values) --------------------

_PLACEHOLDER_SLING_LENGTH: float = 5.0
_PLACEHOLDER_WIRE_ROPE_DEFAULTS = {
    "eye_type": "hard",
    "termination": "ferrule",
    "thimble": "20 mm",
    "configuration": "vertical",
}
# Target utilization per combination key -> placeholder utilization value.
_PLACEHOLDER_TARGETS = {
    "conservative": 0.70,
    "minimum": 1.00,
    "user_specified": 0.90,
}


class RiggingDesigner:
    """Stubbed rigging designer.

    Mirrors the public surface of the original proprietary designer but builds a
    fixed placeholder arrangement and result payload. The output of
    :meth:`to_dict` / :meth:`JSON_serializible_to_dict` matches the shape
    consumed by the service layer, the result enrichment mappers and the
    frontend.
    """

    def __init__(
        self,
        analysis_data: RiggingAnalysisInput,
        user_preferences: Optional[UserPreferencesDTO] = None,
        repository: Optional[ports.RiggingRepository] = None,
    ) -> None:
        if repository is None:
            raise RiggingDesignError("RiggingDesigner requires a RiggingRepository instance")

        self.analysis_data = analysis_data
        self.repository = repository
        self.user_preferences_dto = user_preferences or {}
        # Resolution of explicit component refs is kept (it is plumbing, not IP)
        # so invalid references still raise ComponentNotFoundError as before.
        self.user_preferences = resolve_user_preferences(self.user_preferences_dto, repository)

        self.lifting_points_qty = analysis_data.lifting_points_qty
        self.configuration = analysis_data.configuration
        self.dnv_lifting_factors = analysis_data.results.factors

        self.static_hook_load = analysis_data.results.static_hook_load
        self.static_sling_loads = analysis_data.results.static_sling_loads
        self.dynamic_hook_load = analysis_data.results.dynamic_hook_load
        self.dynamic_sling_loads = analysis_data.results.dynamic_sling_loads

        self.target_conservative_utilization = _PLACEHOLDER_TARGETS["conservative"]
        self.target_user_utilization = _PLACEHOLDER_TARGETS["user_specified"]
        self.target_minimum_utilization = _PLACEHOLDER_TARGETS["minimum"]

        # Placeholder arrangement: one top masterlink plus a (Shackle, WireRope)
        # pair per lifting point. Flat list of component-type strings, matching
        # the original "arrangement" contract.
        self.arrangement: List[str] = ["Masterlink"]
        for _ in range(max(1, self.lifting_points_qty)):
            self.arrangement.extend(["Shackle", "WireRope"])

        # One sling length per wire-rope leg.
        wire_rope_count = sum(1 for c in self.arrangement if c == "WireRope")
        self.sling_lengths: List[float] = [_PLACEHOLDER_SLING_LENGTH] * wire_rope_count

    # -- Validation (shape only, not IP) --------------------------------------

    @staticmethod
    def validate_inputs(
        analysis_data: RiggingAnalysisInput,
        user_preferences: Optional[UserPreferencesDTO] = None,
    ) -> Tuple[bool, str]:
        """Validate that analysis_data and user_preferences are well-formed."""
        if not isinstance(analysis_data, RiggingAnalysisInput):
            return False, "analysis_data must be a RiggingAnalysisInput"

        if (
            not isinstance(analysis_data.lifting_points_qty, int)
            or analysis_data.lifting_points_qty < 1
            or analysis_data.lifting_points_qty > 4
        ):
            return False, "lifting_points_qty must be an integer between 1 and 4"

        if user_preferences is not None:
            if not isinstance(user_preferences, dict):
                return False, "user_preferences must be a dictionary when provided"
            for k, v in user_preferences.items():
                if not isinstance(k, int):
                    return False, "user_preferences keys must be integer indices"
                if not isinstance(v, dict):
                    return False, f"user_preferences[{k}] must be a dictionary"
                if "component_ref" in v and "component_type" in v:
                    return False, f"user_preferences[{k}] cannot include both component_ref and component_type"
                if "component_ref" in v:
                    ref = v["component_ref"]
                    if not isinstance(ref, dict) or not ref.get("type") or ref.get("id") is None:
                        return False, f"user_preferences[{k}].component_ref must include type and id"
                if "capacity" in v:
                    try:
                        float(v["capacity"])
                    except (TypeError, ValueError):
                        return False, f"user_preferences[{k}].capacity must be a number"
        return True, "OK"

    # -- Placeholder result construction --------------------------------------

    def _build_items(self, utilization: float) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        for position, ctype in enumerate(self.arrangement):
            user_capacity = self.user_preferences.get(position, {}).get("capacity")
            item: Dict[str, Any] = {
                "position": position,
                "component_id": f"stub-{ctype.lower()}-{position}",
                "component_type": ctype,
                "label": f"Placeholder {ctype}",
                "utilization": utilization,
                "user_capacity": user_capacity,
            }
            if ctype == "WireRope":
                item.update(_PLACEHOLDER_WIRE_ROPE_DEFAULTS)
            items.append(item)
        return items

    def _build_combination(self, key: str) -> Dict[str, Any]:
        utilization = _PLACEHOLDER_TARGETS.get(key, 0.9)
        items = self._build_items(utilization)
        return {
            "id": [item["component_id"] for item in items],
            "items": items,
            "component_factors": {},
            "component_traces": {},
            "geometric_warning": None,
            "compatibility_details": [],
            "overall_compatible": True,
            "warning_message": None,
        }

    def _optimal_combinations(self) -> Dict[str, Any]:
        return {
            "conservative": self._build_combination("conservative"),
            "minimum": self._build_combination("minimum"),
            # Mirror the original: only present when the user supplied preferences.
            "user_specified": self._build_combination("user_specified")
            if self.user_preferences
            else None,
        }

    def to_dict(self) -> Dict[str, Any]:
        """Service-friendly serialization of the placeholder design results."""
        return {
            "summary": {
                "lifting_points_qty": self.lifting_points_qty,
                "targets": {
                    "conservative": self.target_conservative_utilization,
                    "user": self.target_user_utilization,
                    "minimum": self.target_minimum_utilization,
                },
                "counts": {
                    "compatible": 1,
                    "compliant_no_wire": 1,
                    "compliant": 1,
                },
            },
            "arrangement": list(self.arrangement),
            "optimal_combinations": self._optimal_combinations(),
            "factors": self.dnv_lifting_factors,
            "calculation_context": None,
            "user_preferences": (
                [value for value in self.user_preferences.values()]
                if self.user_preferences
                else None
            ),
            "sling_lengths": list(self.sling_lengths),
        }

    def JSON_serializible_to_dict(self) -> Dict[str, Any]:
        """Same structure as :meth:`to_dict`, sanitized to JSON primitives."""
        safe_payload = _json_safe(self.to_dict())
        arr = safe_payload.get("arrangement")
        if isinstance(arr, (list, tuple)):
            safe_payload["arrangement"] = list(arr)
        else:
            safe_payload["arrangement"] = []
        return safe_payload

    # -- Backwards-compatible no-op helpers -----------------------------------

    def recompute(self) -> Dict[str, Any]:
        return self.to_dict()

    def update_targets(
        self,
        conservative: Optional[float] = None,
        user: Optional[float] = None,
        minimum: Optional[float] = None,
    ) -> None:
        if conservative is not None:
            self.target_conservative_utilization = conservative
        if user is not None:
            self.target_user_utilization = user
        if minimum is not None:
            self.target_minimum_utilization = minimum
