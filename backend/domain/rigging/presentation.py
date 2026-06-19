from typing import Any, Dict, List


def apply_item_display_fields(items: List[Dict[str, Any]], rope_lengths: List[float]) -> List[Dict[str, Any]]:
    """Add display-friendly fields to items without mutating inputs."""
    if not items:
        return []

    out: List[Dict[str, Any]] = []
    rope_idx = 0
    for item in items:
        if not isinstance(item, dict):
            out.append(item)
            continue
        new_item = dict(item)
        try:
            new_item["display_position"] = int(new_item.get("position", 0)) + 1
        except Exception:
            new_item["display_position"] = new_item.get("position")
        if new_item.get("component_type") == "WireRope":
            if rope_idx < len(rope_lengths):
                new_item["sling_length"] = rope_lengths[rope_idx]
            rope_idx += 1
        out.append(new_item)
    return out
