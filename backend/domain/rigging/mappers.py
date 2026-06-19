from typing import Any, Dict, List, Optional
from domain.rigging import ports

def enrich_rigging_results(
    results: Dict[str, Any],
    repository: ports.RiggingRepository,
    rope_lengths: List[float]
) -> Dict[str, Any]:
    """Enrich design results with component data from the repository."""
    from domain.rigging.presentation import apply_item_display_fields

    enriched_results = results.copy()
    opt = (enriched_results.get("optimal_combinations") or {}).copy()
    
    if isinstance(opt, (list, tuple)):
        opt = {str(i): combo for i, combo in enumerate(opt)}
    if not isinstance(opt, dict):
        opt = {}

    for key, combo in list(opt.items()):
        if not isinstance(combo, dict) or not combo:
            continue
            
        items = combo.get("items") or []
        if isinstance(items, dict):
            items = list(items.values())
            
        # Add display fields (position, sling_length)
        items = apply_item_display_fields(items, rope_lengths)
        
        for item in items:
            if not isinstance(item, dict):
                continue
                
            ctype = item.get("component_type")
            cid = item.get("component_id")
            
            if not ctype or cid is None:
                continue
            
            # Use repository to fetch domain component
            component = None
            try:
                ref = ports.ComponentRef(type=str(ctype), id=str(cid))
                component = repository.get_component(ref)
            except Exception:
                component = None
                
            if component:
                item["manufacturer"] = getattr(component, "manufacturer", None)
                item["model"] = getattr(component, "model", None)
                if ctype == "WireRope":
                    item["wll_or_mbl"] = getattr(component, "minimum_breaking_load", None)
                    item["diameter"] = getattr(component, "nominal_diameter", None)
                else:
                    item["wll_or_mbl"] = getattr(component, "working_load_limit", None)
        
        combo["items"] = items
        combo["component_items"] = items
        opt[key] = combo

    enriched_results["optimal_combinations"] = opt
    return enriched_results
