from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional, Protocol, Sequence, Union

Id = str #or UUID

ComponentType = Literal["Masterlink", "MasterlinkAssembly", "WireRope", "Shackle"]

@dataclass(frozen=True)
class ComponentRef:
    type: ComponentType
    id: Id

@dataclass(frozen=True)
class Masterlink:
    id: Id
    manufacturer: Optional[str]
    model: Optional[str]
    working_load_limit: float
    safety_factor: float
    diameter: float
    width_inside: float
    name: Optional[str] = None

@dataclass(frozen=True)
class MasterlinkAssembly:
    id: Id
    manufacturer: Optional[str]
    model: Optional[str]
    working_load_limit: float
    safety_factor: float
    assembly_diameter: float
    assembly_width_inside: float
    name: Optional[str] = None

@dataclass(frozen=True)
class Shackle:
    id: Id
    manufacturer: Optional[str]
    model: Optional[str]
    working_load_limit: float
    safety_factor: float
    inside_width: float
    tolerance_inside_width: float
    bow_width: float
    eye_diameter: float
    bow_diameter: float
    pin_diameter: float
    name: Optional[str] = None

@dataclass(frozen=True)
class WireRope:
    id : Id
    minimum_breaking_load: float
    nominal_diameter: float
    material: str
    name: Optional[str] = None

@dataclass(frozen=True)
class SlingConfiguration:
    id : Id
    configuration: str
    termination: str
    eye_type: str

@dataclass(frozen=True)
class Thimble:
    id : Id
    min_wire_rope_diameter: float
    max_wire_rope_diameter: float
    thickness_back: float
    length_inside: float
    width_inside: float

LiftComponent = Union[Masterlink, MasterlinkAssembly, Shackle, WireRope]
Accessory = Union[Thimble]
Config = Union[SlingConfiguration]
RiggingComponent = Union[LiftComponent, Accessory]
Component = RiggingComponent

class RiggingRepository(Protocol):
    def list_masterlinks(
            self,
            manufacturer: Optional[str] = None,
            model: Optional[str] = None,
    ) -> Sequence[Masterlink]:
        ...

    def list_masterlink_assemblies(
            self,
            manufacturer: Optional[str] = None,
            model: Optional[str] = None,
    ) -> Sequence[MasterlinkAssembly]:
        ...

    def list_shackles(
            self,
            manufacturer: Optional[str] = None,
            model: Optional[str] = None,
    ) -> Sequence[Shackle]:
        ...

    def list_wire_ropes(self) -> Sequence[WireRope]:
        ...

    def get_sling_configuration_for_wire_rope(
            self,
            wire_rope_id: Id,
            configuration: str,
            termination: str,
            eye_type: str,
    ) -> Optional[SlingConfiguration]:
        ...

    def list_thimbles_for_diameter(self, diameter: float) -> Sequence[Thimble]:
        ...

    def list_thimbles(self) -> Sequence[Thimble]:
        ...

    def get_shackle(self, id: Id) -> Optional[Shackle]:
        ...

    def get_masterlink(self, id: Id) -> Optional[Masterlink]:
        ...

    def get_masterlink_assembly(self, id: Id) -> Optional[MasterlinkAssembly]:
        ...

    def get_wire_rope(self, id: Id) -> Optional[WireRope]:
        ...

    def get_component(self, ref: ComponentRef) -> Optional[Component]:
        ...

