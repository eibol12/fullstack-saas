"""Public stub of the 3D structure model.

The structural-analysis bookkeeping that fed the proprietary lifting solver —
degree-of-freedom assignment, constraint/force handling and matrix preparation
— has been removed from the public version. A lightweight node/element
container and the observer plumbing are retained so the package imports cleanly
and the (stubbed) calculator can be constructed.

See ``domain/STUB_NOTICE.md`` for details.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Dict, List, Optional

from domain.geometry.element import Element3D
from domain.geometry.node import Node3D


class StructureEvent(Enum):
    """Events that can occur in a Structure3D instance."""

    NODE_ADDED = auto()
    NODE_REMOVED = auto()
    NODE_UPDATED = auto()
    ELEMENT_ADDED = auto()
    ELEMENT_REMOVED = auto()
    ELEMENT_UPDATED = auto()
    CONSTRAINT_CHANGED = auto()
    FORCE_CHANGED = auto()
    RESET = auto()


@dataclass
class StructureEventData:
    """Data associated with a structure event."""

    event_type: StructureEvent
    entity_id: Optional[int] = None
    old_value: Any = None
    new_value: Any = None
    additional_info: Dict[str, Any] = field(default_factory=dict)


class StructureObserver:
    """Observer interface for structure change events."""

    def update(self, structure: "Structure3D", event_data: StructureEventData) -> None:
        pass


class Structure3D:
    """Lightweight node/element container (analysis logic removed)."""

    def __init__(self) -> None:
        self.nodes: Dict[int, Node3D] = {}
        self.elements: Dict[int, Element3D] = {}
        self._observers: List[StructureObserver] = []
        self._next_node_id = 0
        self._next_element_id = 0

    def __repr__(self) -> str:
        return f"Structure3D(nodes={len(self.nodes)}, elements={len(self.elements)})"

    def __str__(self) -> str:
        return self.__repr__()

    # -- Observer plumbing ----------------------------------------------------

    def register_observer(self, observer: StructureObserver) -> None:
        if observer not in self._observers:
            self._observers.append(observer)

    def unregister_observer(self, observer: StructureObserver) -> None:
        if observer in self._observers:
            self._observers.remove(observer)

    def notify_observers(self, event_data: StructureEventData) -> None:
        for observer in list(self._observers):
            observer.update(self, event_data)

    # -- Node / element management -------------------------------------------

    def add_node(self, node: Node3D, is_support: bool = False) -> int:
        node_id = self._next_node_id
        self.nodes[node_id] = node
        self._next_node_id += 1
        self.notify_observers(StructureEventData(StructureEvent.NODE_ADDED, entity_id=node_id))
        return node_id

    def remove_node(self, node_id: int, remove_connected_elements: bool = True) -> Optional[Node3D]:
        node = self.nodes.pop(node_id, None)
        self.notify_observers(StructureEventData(StructureEvent.NODE_REMOVED, entity_id=node_id))
        return node

    def update_node(self, node_id, x=None, y=None, z=None):
        self.notify_observers(StructureEventData(StructureEvent.NODE_UPDATED, entity_id=node_id))

    def add_element(self, element: Element3D) -> int:
        element_id = self._next_element_id
        self.elements[element_id] = element
        self._next_element_id += 1
        self.notify_observers(StructureEventData(StructureEvent.ELEMENT_ADDED, entity_id=element_id))
        return element_id

    def remove_element(self, element_id: int, remove_orphaned_nodes: bool = False) -> Optional[Element3D]:
        element = self.elements.pop(element_id, None)
        self.notify_observers(StructureEventData(StructureEvent.ELEMENT_REMOVED, entity_id=element_id))
        return element

    # -- Stubbed analysis bookkeeping (IP removed) ---------------------------

    def set_node_constraint(self, node_id: int, is_support: bool) -> None:
        self.notify_observers(StructureEventData(StructureEvent.CONSTRAINT_CHANGED, entity_id=node_id))

    def is_node_support(self, node_id: int) -> bool:
        return False

    def set_node_force(self, node_id: int, direction: str, force: float) -> None:
        self.notify_observers(StructureEventData(StructureEvent.FORCE_CHANGED, entity_id=node_id))

    def get_node_forces(self, node_id: int) -> Dict[str, float]:
        return {}

    def get_connected_elements(self, node_id: int) -> List[int]:
        return []

    def get_dofs(self, node_id: int) -> List[int]:
        return []

    def reset(self) -> None:
        self.nodes.clear()
        self.elements.clear()
        self.notify_observers(StructureEventData(StructureEvent.RESET))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nodes": {
                str(nid): (node.to_dict() if hasattr(node, "to_dict") else None)
                for nid, node in self.nodes.items()
            },
            "elements": {
                str(eid): (el.to_dict() if hasattr(el, "to_dict") else None)
                for eid, el in self.elements.items()
            },
        }
