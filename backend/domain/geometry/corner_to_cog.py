"""Corner-reference → COG-relative geometry conversion.

Engineers typically only have a rigging drawing with absolute coordinates
measured from a physical corner of the skid (no CAD access to extract
COG-relative distances). This helper converts those absolute coordinates
into the legacy ``configuration`` dict that the DNV engine consumes
(``L_i``/``h_i``/``B_i`` per lifting point).

The DNV engine (see ``domain/standards/dnv.py``) interprets the stored
configuration values as offsets measured from the COG along each axis:

- ``L_i``  →  horizontal distance from COG to lifting point on the X axis
- ``B_i``  →  horizontal distance from COG to lifting point on the Y axis
- ``h_i``  →  vertical offset of the lifting point above the COG plane

Therefore the conversion is straightforward::

    L_i = |x_i - x_cog|
    B_i = |y_i - y_cog|
    h_i =  z_i - z_cog

The raw input payload is round-tripped to the caller so the UI can
re-populate the form on edit.
"""

from __future__ import annotations

from typing import Any, Dict, List

from domain.utils.exceptions import DomainValidationError


_ALLOWED_LIFTING_POINTS = (1, 2, 3, 4)


def _coerce_float(value: Any, field: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise DomainValidationError(f"{field} must be a number.") from exc


def _coerce_xyz(payload: Any, field: str) -> Dict[str, float]:
    if not isinstance(payload, dict):
        raise DomainValidationError(f"{field} must be an object with x, y, z keys.")
    return {
        "x": _coerce_float(payload.get("x"), f"{field}.x"),
        "y": _coerce_float(payload.get("y"), f"{field}.y"),
        "z": _coerce_float(payload.get("z"), f"{field}.z"),
    }


def convert_corner_coords_to_cog_config(geometry_input: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a corner-reference geometry payload to the engine config shape.

    Parameters:
        geometry_input: ``{ skid: {length, width, height},
                            cog: {x, y, z},
                            points: [{x, y, z}, ...] }``

    Returns:
        A dict matching the legacy ``configuration`` shape consumed by
        ``DNVLiftingOperations`` plus a ``geometry_input`` key that
        round-trips the raw payload::

            {
              "lifting_points_qty": int,
              "L1": float, "h1": float, "B1": float, ...,
              "geometry_input": { ...raw payload... },
            }

    Raises:
        DomainValidationError: If the payload is malformed.
    """
    if not isinstance(geometry_input, dict):
        raise DomainValidationError("geometry_input must be an object.")

    skid = geometry_input.get("skid")
    if not isinstance(skid, dict):
        raise DomainValidationError("geometry_input.skid is required.")
    skid_length = _coerce_float(skid.get("length"), "skid.length")
    skid_width = _coerce_float(skid.get("width"), "skid.width")
    skid_height = _coerce_float(skid.get("height"), "skid.height")
    if skid_length <= 0 or skid_width <= 0 or skid_height <= 0:
        raise DomainValidationError("Skid dimensions must be positive numbers.")

    cog = _coerce_xyz(geometry_input.get("cog"), "cog")

    raw_points: List[Any] = geometry_input.get("points") or []
    if not isinstance(raw_points, list) or not raw_points:
        raise DomainValidationError("geometry_input.points must be a non-empty list.")
    if len(raw_points) not in _ALLOWED_LIFTING_POINTS:
        raise DomainValidationError(
            f"Lifting points quantity must be one of: {list(_ALLOWED_LIFTING_POINTS)}."
        )

    points = [_coerce_xyz(p, f"points[{i}]") for i, p in enumerate(raw_points)]

    # Optional sanity check: lifting points must lie within the skid footprint.
    for idx, p in enumerate(points, start=1):
        if not (0 <= p["x"] <= skid_length):
            raise DomainValidationError(
                f"Lifting point {idx} x={p['x']} is outside skid length [0, {skid_length}]."
            )
        if not (0 <= p["y"] <= skid_width):
            raise DomainValidationError(
                f"Lifting point {idx} y={p['y']} is outside skid width [0, {skid_width}]."
            )

    config: Dict[str, Any] = {"lifting_points_qty": len(points)}
    for idx, p in enumerate(points, start=1):
        config[f"L{idx}"] = abs(p["x"] - cog["x"])
        config[f"B{idx}"] = abs(p["y"] - cog["y"])
        # h_i is the LP elevation relative to the COG plane (engine uses -h_max + h_i)
        config[f"h{idx}"] = p["z"] - cog["z"]

    # Round-trip the raw payload so the UI can re-hydrate the form on edit.
    config["geometry_input"] = {
        "skid": {"length": skid_length, "width": skid_width, "height": skid_height},
        "cog": cog,
        "points": points,
    }

    return config
