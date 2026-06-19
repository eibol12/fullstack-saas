from typing import Any, Dict, Iterable, List, Tuple


LIFTING_SHAPE_RULES = [
    "maximum_gross_weight is present and a positive number",
    "location is a valid enum value",
    "configuration is a non-empty dict",
    "configuration.lifting_points_qty is an allowed integer",
]

LIFTING_ENGINEERING_RULES = [
    "h_max is a positive number",
    "for 3 lifting points, quadrant is provided and valid",
    "geometry values (L*, B*, h*) are non-negative when provided",
]


def validate_lifting_shape_inputs(
    maximum_gross_weight: float,
    location: str,
    configuration: Dict[str, Any],
    *,
    allowed_locations: Iterable[str],
    allowed_lifting_points: Iterable[int],
) -> List[str]:
    """Return a list of shape/typing validation errors."""
    errors: List[str] = []

    try:
        if maximum_gross_weight is None or float(maximum_gross_weight) <= 0:
            errors.append("Maximum gross weight must be a positive number.")
    except (TypeError, ValueError):
        errors.append("Maximum gross weight must be a number.")

    allowed = {str(loc).lower() for loc in allowed_locations}
    if not isinstance(location, str) or location.lower() not in allowed:
        errors.append(f"Location must be one of: {', '.join(sorted(allowed_locations))}.")

    if not isinstance(configuration, dict) or not configuration:
        errors.append("Configuration is required and must be a dictionary.")

    lifting_points_qty = configuration.get("lifting_points_qty") if isinstance(configuration, dict) else None
    try:
        lifting_points_qty_int = int(lifting_points_qty)
    except (TypeError, ValueError):
        errors.append("Lifting points quantity must be an integer.")
    else:
        allowed_points = set(int(x) for x in allowed_lifting_points)
        if lifting_points_qty_int not in allowed_points:
            errors.append(f"Lifting points quantity must be one of: {sorted(allowed_points)}.")

    return errors


def validate_lifting_engineering_rules(
    configuration: Dict[str, Any],
    *,
    lifting_points_qty: int,
) -> List[str]:
    """Return a list of engineering validation errors."""
    errors: List[str] = []

    try:
        h_max = configuration.get("h_max")
        if h_max is None or float(h_max) <= 0:
            errors.append("Maximum crane height (h_max) must be a positive number.")
    except (TypeError, ValueError):
        errors.append("Maximum crane height (h_max) must be a number.")

    if lifting_points_qty == 3:
        quadrant = configuration.get("quadrant")
        if quadrant is None:
            errors.append("Quadrant is required for 3 lifting points.")
        elif str(quadrant).lower() not in {"left", "right", "center"}:
            errors.append("Quadrant must be one of: left, right, center.")

    # Geometry values should be non-negative when provided
    for key, value in configuration.items():
        if not isinstance(key, str):
            continue
        if not (key.startswith("L") or key.startswith("B") or key.startswith("h")):
            continue
        if value is None or value == "":
            continue
        try:
            if float(value) < 0:
                errors.append(f"{key} must be a non-negative number.")
        except (TypeError, ValueError):
            errors.append(f"{key} must be a number.")

    return errors


def validate_lifting_inputs(
    maximum_gross_weight: float,
    location: str,
    configuration: Dict[str, Any],
    *,
    allowed_locations: Iterable[str],
    allowed_lifting_points: Iterable[int],
) -> Tuple[bool, str]:
    shape_errors = validate_lifting_shape_inputs(
        maximum_gross_weight,
        location,
        configuration,
        allowed_locations=allowed_locations,
        allowed_lifting_points=allowed_lifting_points,
    )
    if shape_errors:
        return False, shape_errors[0]

    lifting_points_qty_int = int(configuration.get("lifting_points_qty"))
    engineering_errors = validate_lifting_engineering_rules(
        configuration,
        lifting_points_qty=lifting_points_qty_int,
    )
    if engineering_errors:
        return False, engineering_errors[0]

    return True, ""


def validate_lifting_points_qty(
    lifting_points_qty: Any,
    *,
    allowed_lifting_points: Iterable[int],
) -> Tuple[bool, str]:
    try:
        qty = int(lifting_points_qty)
    except (TypeError, ValueError):
        return False, "Lifting points quantity must be an integer."
    allowed_points = set(int(x) for x in allowed_lifting_points)
    if qty not in allowed_points:
        return False, f"Lifting points quantity must be one of: {sorted(allowed_points)}."
    return True, ""
