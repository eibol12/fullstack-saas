"""Public stub of the lifting structural calculator.

This is the core proprietary solver of the project: it assembled the global
stiffness matrix, applied boundary conditions and solved for displacements,
reactions and member forces (and hence sling loads). That intellectual property
has been removed from the public version. The class below preserves the public
surface but returns inert placeholder results.

See ``domain/STUB_NOTICE.md`` for details.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import numpy as np
from numpy.typing import NDArray

from domain.structure.structure import (
    Structure3D,
    StructureEventData,
    StructureObserver,
)


class LiftingCalculator(StructureObserver):
    """Stubbed lifting calculator (finite-element solver removed)."""

    def __init__(self, structure: Optional[Structure3D] = None) -> None:
        self.structure = structure if structure is not None else Structure3D()
        self.structure.register_observer(self)
        self._analysis_performed = False

    def update(self, structure: Structure3D, event_data: StructureEventData) -> None:
        # Any structural change invalidates the (stubbed) analysis state.
        self._analysis_performed = False

    # -- Stubbed matrices / vectors (IP removed) -----------------------------

    @property
    def primary_stiffness_matrix(self) -> NDArray:
        return np.zeros((0, 0))

    @property
    def reduced_stiffness_matrix(self) -> NDArray:
        return np.zeros((0, 0))

    @property
    def global_force_vector(self) -> NDArray:
        return np.zeros(0)

    @property
    def global_displacement_vector(self) -> NDArray:
        return np.zeros(0)

    @property
    def global_reaction_vector(self) -> NDArray:
        return np.zeros(0)

    @property
    def dof_mapping(self) -> Dict[int, Dict[str, Any]]:
        return {}

    # -- Lifecycle ------------------------------------------------------------

    def analyze(self) -> None:
        self._analysis_performed = True

    def get_node_data(self, node_id: int) -> Dict[str, Any]:
        return {}

    def get_element_data(self, element_id: int) -> Dict[str, Any]:
        return {}

    def get_analysis_summary(self) -> Dict[str, Any]:
        return {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "structure": self.structure.to_dict()
            if hasattr(self.structure, "to_dict")
            else {"nodes": {}, "elements": {}},
        }
