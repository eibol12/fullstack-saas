from typing import Any, Dict

from domain.rigging.errors import ComponentNotFoundError, InvalidUserPreferenceError
from domain.rigging.ports import ComponentRef, RiggingRepository
from domain.rigging.types import UserPreferencesDTO


HINT_KEYS = ("manufacturer", "model", "configuration", "termination", "eye_type")


def resolve_user_preferences(
    user_preferences: UserPreferencesDTO,
    repository: RiggingRepository,
) -> Dict[int, Dict[str, Any]]:
    if not user_preferences:
        return {}
    if isinstance(user_preferences, list):
        user_preferences = {
            idx: pref for idx, pref in enumerate(user_preferences) if pref
        }
    if not isinstance(user_preferences, dict):
        raise InvalidUserPreferenceError("user_preferences must be a dict of positions -> selection dict")

    resolved: Dict[int, Dict[str, Any]] = {}
    for idx, pref in user_preferences.items():
        if not isinstance(idx, int):
            raise InvalidUserPreferenceError("user_preferences keys must be integer indices")
        if not isinstance(pref, dict):
            raise InvalidUserPreferenceError(f"user_preferences[{idx}] must be a dict")

        component_ref = pref.get("component_ref")
        component_type = pref.get("component_type")

        if component_ref and component_type:
            raise InvalidUserPreferenceError(
                f"user_preferences[{idx}] cannot include both component_ref and component_type"
            )

        resolved_entry: Dict[str, Any] = {}

        if component_ref:
            if not isinstance(component_ref, dict):
                raise InvalidUserPreferenceError(f"user_preferences[{idx}].component_ref must be a dict")
            ref_type = component_ref.get("type")
            ref_id = component_ref.get("id")
            if not ref_type or ref_id is None:
                raise InvalidUserPreferenceError(f"user_preferences[{idx}].component_ref must include type and id")
            ref = ComponentRef(type=ref_type, id=str(ref_id))
            component = repository.get_component(ref)
            if component is None:
                raise ComponentNotFoundError(ref)
            resolved_entry["resolved_component"] = component
            resolved_entry["component_type"] = ref.type
        elif component_type:
            resolved_entry["component_type"] = component_type

        if "capacity" in pref:
            cap = pref.get("capacity")
            if cap is not None:
                try:
                    resolved_entry["capacity"] = float(cap)
                except (TypeError, ValueError):
                    raise InvalidUserPreferenceError(f"user_preferences[{idx}].capacity must be a number")

        for key in HINT_KEYS:
            val = pref.get(key)
            if val not in (None, ""):
                resolved_entry[key] = val

        if resolved_entry:
            resolved[idx] = resolved_entry

    return resolved
