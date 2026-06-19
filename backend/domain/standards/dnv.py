"""Public stub of the DNV lifting-operations engine.

This module is a PLACEHOLDER. The real DNV-compliant lifting calculations
(hook-load classes, dynamic amplification factors, skew-load distribution,
sling-load solving, etc.) are proprietary and have been removed from the
public version of this project.

The class below preserves the *public interface* and the *output shape* that
the rest of the application depends on, but returns fixed, generic placeholder
values instead of performing any real engineering analysis. It is sufficient
to exercise the full application workflow (analyze → persist → design → report)
end to end, but the numbers it produces are NOT engineering-valid and must not
be used for any real lifting operation.

See ``domain/STUB_NOTICE.md`` for details.
"""

from __future__ import annotations

from typing import Any, Dict, List

# --- Fixed placeholder constants (NOT engineering values) --------------------

_PLACEHOLDER_FACTORS: Dict[str, float] = {
    "weight_factor": 1.05,
    "rigging_weight_factor": 1.05,
    "cog_factor": 1.05,
    "yaw_factor": 1.0,
    "skew_load_factor": 1.25,
    "dynamic_amplification_factor": 1.30,
}

_PLACEHOLDER_STATIC_HOOK_LOAD: float = 100.0
_PLACEHOLDER_DYNAMIC_HOOK_LOAD: float = 130.0
_PLACEHOLDER_STATIC_SLING_LOAD: float = 25.0
_PLACEHOLDER_DYNAMIC_SLING_LOAD: float = 32.5
_PLACEHOLDER_HOOK_LOAD_CLASS: int = 2


class DNVLiftingOperations:
    """Stubbed lifting-operations analysis.

    Mirrors the public surface of the original proprietary engine but returns
    fixed placeholder results. The output of :meth:`to_dict` matches the shape
    consumed by ``apps.main.services.lifting`` and the rigging design engine.
    """

    def __init__(
        self,
        maximum_gross_weight: float,
        location: str,
        configuration: Dict[str, Any],
    ) -> None:
        self._maximum_gross_weight = maximum_gross_weight
        self._location = location
        self._configuration = dict(configuration or {})
        self._analysis_performed = False

        # Default DNV-style factors (placeholders).
        self._weight_factor = _PLACEHOLDER_FACTORS["weight_factor"]
        self._rigging_weight_factor = _PLACEHOLDER_FACTORS["rigging_weight_factor"]
        self._cog_factor = _PLACEHOLDER_FACTORS["cog_factor"]
        self._yaw_factor = _PLACEHOLDER_FACTORS["yaw_factor"]
        self._skew_load_factor = _PLACEHOLDER_FACTORS["skew_load_factor"]
        self._dynamic_amplification_factor = _PLACEHOLDER_FACTORS[
            "dynamic_amplification_factor"
        ]

    # -- Core parameters ------------------------------------------------------

    @property
    def maximum_gross_weight(self) -> float:
        return self._maximum_gross_weight

    @maximum_gross_weight.setter
    def maximum_gross_weight(self, value: float) -> None:
        self._maximum_gross_weight = value

    @property
    def location(self) -> str:
        return self._location

    @location.setter
    def location(self, value: str) -> None:
        self._location = value

    @property
    def configuration(self) -> Dict[str, Any]:
        return self._configuration

    @configuration.setter
    def configuration(self, value: Dict[str, Any]) -> None:
        self._configuration = dict(value or {})

    # -- Derived helpers ------------------------------------------------------

    def _lifting_points_qty(self) -> int:
        try:
            qty = int(self._configuration.get("lifting_points_qty", 1))
        except (TypeError, ValueError):
            qty = 1
        return max(1, qty)

    # -- DNV factors / results (placeholders) ---------------------------------

    @property
    def weight_factor(self) -> float:
        return self._weight_factor

    @property
    def rigging_weight_factor(self) -> float:
        return self._rigging_weight_factor

    @property
    def cog_factor(self) -> float:
        return self._cog_factor

    @property
    def yaw_factor(self) -> float:
        return self._yaw_factor

    @property
    def skew_load_factor(self) -> float:
        return self._skew_load_factor

    @property
    def dynamic_amplification_factor(self) -> float:
        return self._dynamic_amplification_factor

    @property
    def static_hook_load(self) -> float:
        return _PLACEHOLDER_STATIC_HOOK_LOAD

    @property
    def static_hook_load_class(self) -> int:
        return _PLACEHOLDER_HOOK_LOAD_CLASS

    @property
    def dynamic_hook_load(self) -> float:
        return _PLACEHOLDER_DYNAMIC_HOOK_LOAD

    @property
    def subsea_maximum_gross_weight(self) -> float:
        return self._maximum_gross_weight

    @property
    def sling_loads(self) -> Dict[str, Dict[int, float]]:
        qty = self._lifting_points_qty()
        return {
            "static": {i: _PLACEHOLDER_STATIC_SLING_LOAD for i in range(1, qty + 1)},
            "dynamic": {i: _PLACEHOLDER_DYNAMIC_SLING_LOAD for i in range(1, qty + 1)},
        }

    def get_dnv_factors(self) -> Dict[str, float]:
        return {
            "weight_factor": self.weight_factor,
            "rigging_weight_factor": self.rigging_weight_factor,
            "cog_factor": self.cog_factor,
            "yaw_factor": self.yaw_factor,
            "skew_load_factor": self.skew_load_factor,
            "dynamic_amplification_factor": self.dynamic_amplification_factor,
        }

    def get_static_results(self) -> Dict[str, Any]:
        return {
            "hook_load": self.static_hook_load,
            "static_sling_loads": self.sling_loads.get("static", {}),
        }

    def get_dynamic_results(self) -> Dict[str, Any]:
        return {
            "hook_load": self.dynamic_hook_load,
            "dynamic_sling_loads": self.sling_loads.get("dynamic", {}),
        }

    def get_geometry_data(self) -> Dict[str, Any]:
        """Return a shape-valid but empty geometry payload.

        The frontend 3D visualizer rebuilds geometry from ``configuration``
        (skid dimensions / lifting points), so an empty structure here is fine.
        """
        return {"structure": {"nodes": {}, "elements": {}}}

    # -- Lifecycle ------------------------------------------------------------

    def analyze(self) -> None:
        """No-op placeholder. Real analysis has been removed."""
        self._analysis_performed = True

    def update_configuration_parameter(self, parameter_name: str, value: Any) -> None:
        """Update a single configuration entry (no recomputation needed)."""
        self._configuration[parameter_name] = value

    def to_dict(self) -> Dict[str, Any]:
        """Serializable analysis payload consumed by the application layer."""
        return {
            "factors": self.get_dnv_factors(),
            "static_results": self.get_static_results(),
            "dynamic_results": self.get_dynamic_results(),
            "geometry": self.get_geometry_data(),
        }
