from dataclasses import dataclass
from typing import Any, Dict, TypedDict

from domain.rigging.ports import ComponentType


class ComponentRefDTO(TypedDict):
    type: ComponentType
    id: str


class UserPreferenceDTO(TypedDict, total=False):
    component_ref: ComponentRefDTO
    component_type: ComponentType
    capacity: float
    manufacturer: str
    model: str
    configuration: str
    termination: str
    eye_type: str


UserPreferencesDTO = Dict[int, UserPreferenceDTO]


@dataclass(frozen=True)
class RiggingAnalysisResults:
    factors: Dict[str, float]
    static_hook_load: float
    static_sling_loads: Dict[int, float]
    dynamic_hook_load: float
    dynamic_sling_loads: Dict[int, float]


@dataclass(frozen=True)
class RiggingAnalysisInput:
    lifting_points_qty: int
    configuration: Dict[str, Any]
    results: RiggingAnalysisResults


@dataclass(frozen=True)
class RiggingDesignInput:
    analysis_data: RiggingAnalysisInput
    user_preferences: UserPreferencesDTO
