from typing import List, Set

from domain.utils.exceptions import (
    InvalidArrangementLengthError,
    InvalidComponentTypeError,
    InvalidFirstComponentError,
    InvalidLastComponentError,
    MissingRequiredComponentError,
    WireRopeLastComponentError,
)


MIN_ARRANGEMENT_COMPONENTS = 3
MAX_ARRANGEMENT_COMPONENTS = 10

VALID_RIGGING_COMPONENTS = {
    "Masterlink",
    "MasterlinkAssembly",
    "WireRope",
    "Shackle",
}

COMPONENT_LABELS = {
    "Masterlink": "Masterlink",
    "MasterlinkAssembly": "Masterlink Assembly",
    "WireRope": "Wire Rope",
    "Shackle": "Shackle",
}

RIGGING_ENGINEERING_RULES = [
    "custom arrangement has 3-10 components",
    "first component matches lifting points qty (Masterlink or MasterlinkAssembly)",
    "last component is Shackle",
    "required components are present (Masterlink or MasterlinkAssembly, WireRope, Shackle)",
    "WireRope is not the last component",
    "all component types are valid",
]


def _get_expected_first_component(lifting_points_qty: int) -> str:
    return "Masterlink" if lifting_points_qty in [1, 2] else "MasterlinkAssembly"


def _get_required_components(lifting_points_qty: int) -> Set[str]:
    required_components = {"WireRope", "Shackle"}
    required_components.add(_get_expected_first_component(lifting_points_qty))
    return required_components


def _get_component_label(component_type: str) -> str:
    return COMPONENT_LABELS.get(component_type, component_type)


def _format_component_list(components: Set[str]) -> str:
    return ", ".join(_get_component_label(component) for component in sorted(components))


def validate_rigging_arrangement(arrangement: List[str], lifting_points_qty: int) -> None:
    """Raise a domain exception if the custom arrangement violates engineering rules."""
    component_count = len(arrangement) if arrangement else 0
    if component_count < MIN_ARRANGEMENT_COMPONENTS or component_count > MAX_ARRANGEMENT_COMPONENTS:
        raise InvalidArrangementLengthError(
            f"Custom arrangement must contain between {MIN_ARRANGEMENT_COMPONENTS} and "
            f"{MAX_ARRANGEMENT_COMPONENTS} components. Found {component_count}."
        )

    for component in arrangement:
        if component not in VALID_RIGGING_COMPONENTS:
            raise InvalidComponentTypeError(
                f"Custom arrangement contains an unsupported component type: '{component}'."
            )

    expected_first_component = _get_expected_first_component(lifting_points_qty)
    expected_first_label = _get_component_label(expected_first_component)

    if arrangement[0] != expected_first_component:
        raise InvalidFirstComponentError(
            "Custom arrangement is invalid. "
            f"For {lifting_points_qty} lifting point{'s' if lifting_points_qty != 1 else ''}, "
            f"the first component must be {expected_first_label}."
        )

    if arrangement[-1] == "WireRope":
        raise WireRopeLastComponentError(
            "Custom arrangement is invalid. Wire Rope cannot be the last component."
        )

    if arrangement[-1] != "Shackle":
        raise InvalidLastComponentError(
            "Custom arrangement is invalid. The last component must be Shackle."
        )

    required_components = _get_required_components(lifting_points_qty)
    arrangement_set = set(arrangement)
    missing_components = required_components - arrangement_set
    if missing_components:
        raise MissingRequiredComponentError(
            "Custom arrangement is incomplete. Missing required component"
            f"{'s' if len(missing_components) != 1 else ''}: {_format_component_list(missing_components)}."
        )
