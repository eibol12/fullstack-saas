from decimal import Decimal
from uuid import UUID
from datetime import datetime, date
from dataclasses import is_dataclass
import numpy as np

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
    # Check if it looks like a Django model or a domain port object
    if hasattr(obj, "id") and any(
        hasattr(obj, k) for k in ("manufacturer", "model", "working_load_limit", "nominal_diameter")
    ):
        return _ref_from_component(obj)
    return None

def json_safe(value):
    """
    Recursively sanitize a value to be JSON-serializable.
    Handles Decimals, UUIDs, datetimes, numpy types, and objects with an 'id'.
    """
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
        return [json_safe(x) for x in value.tolist()]

    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [json_safe(v) for v in value]
    
    # Fallback for Django models or other objects not caught by _model_to_ref
    if hasattr(value, "__class__") and value.__class__.__name__ in ("Masterlink", "Shackle", "MasterlinkAssembly", "WireRope", "FibreSling", "Grommet"):
        return {"type": value.__class__.__name__, "id": str(getattr(value, "id", None))}

    try:
        # If it's something we don't know but might be iterable
        return [json_safe(v) for v in value]
    except TypeError:
        pass

    return str(value)
