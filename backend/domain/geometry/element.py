"""Public stub of the 3D structural element.

The generic geometry of an element (its end nodes, length and direction
cosines) is retained because it is commodity vector maths. The proprietary
finite-element behaviour — local stiffness matrix assembly, coordinate
transformation, displacement solving and internal-force recovery — has been
removed from the public version and replaced with inert placeholders.

See ``domain/STUB_NOTICE.md`` for details.
"""

from __future__ import annotations

from typing import Any, List

import numpy as np
from numpy.typing import NDArray

from domain.geometry.node import Node3D


class Element3D:
    """A 3D structural element defined by two nodes (geometry only).

    Stiffness / displacement / internal-force calculations are stubbed.
    """

    def __init__(
        self,
        initial_node: Node3D,
        end_node: Node3D,
        elastic_modulus: float,
        cross_sectional_area: float,
    ) -> None:
        self.initial_node = initial_node
        self.end_node = end_node
        self.elastic_modulus = elastic_modulus
        self.cross_sectional_area = cross_sectional_area

        self._length = None
        self._internal_force = None

    def __contains__(self, item: Any) -> bool:
        return item in (self.initial_node, self.end_node)

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}("
            f"initial_node={repr(self.initial_node)}, "
            f"end_node={repr(self.end_node)}, "
            f"elastic_modulus={self.elastic_modulus}, "
            f"cross_sectional_area={self.cross_sectional_area})"
        )

    def __str__(self) -> str:
        return f"Element from {self.initial_node} to {self.end_node}"

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, Element3D):
            return False
        return (
            self.initial_node == other.initial_node
            and self.end_node == other.end_node
            and self.elastic_modulus == other.elastic_modulus
            and self.cross_sectional_area == other.cross_sectional_area
        )

    def __hash__(self):
        return hash(
            (
                self.initial_node,
                self.end_node,
                self.elastic_modulus,
                self.cross_sectional_area,
            )
        )

    # -- Generic geometry (not IP) -------------------------------------------

    @property
    def length(self) -> float:
        if self._length is None:
            dx = self.end_node.x - self.initial_node.x
            dy = self.end_node.y - self.initial_node.y
            dz = self.end_node.z - self.initial_node.z
            self._length = float((dx * dx + dy * dy + dz * dz) ** 0.5)
        return self._length

    def get_direction_cosines(self) -> tuple[float, float, float]:
        length = self.length
        if length == 0:
            return (0.0, 0.0, 0.0)
        dx = self.end_node.x - self.initial_node.x
        dy = self.end_node.y - self.initial_node.y
        dz = self.end_node.z - self.initial_node.z
        return (dx / length, dy / length, dz / length)

    # -- Stubbed finite-element behaviour (IP removed) -----------------------

    @property
    def local_stiffness_matrix(self) -> NDArray:
        return np.zeros((6, 6))

    @property
    def transformation_matrix(self) -> NDArray:
        return np.zeros((6, 6))

    @property
    def global_displacement_vector(self) -> NDArray:
        return np.zeros(6)

    @property
    def local_displacement_vector(self) -> NDArray:
        return np.zeros(2)

    @property
    def internal_force(self) -> float:
        return 0.0

    def set_global_displacement_vector(
        self, global_displacement_vector: NDArray, dofs: List[int]
    ) -> None:
        self._internal_force = None

    def to_dict(self) -> dict:
        return {
            "initial_node": self.initial_node.to_dict()
            if hasattr(self.initial_node, "to_dict")
            else None,
            "end_node": self.end_node.to_dict()
            if hasattr(self.end_node, "to_dict")
            else None,
            "elastic_modulus": self.elastic_modulus,
            "cross_sectional_area": self.cross_sectional_area,
            "length": self.length,
        }
