from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from django.templatetags.static import static
from django.utils import timezone

from apps.main.models import RiggingDesign, UserProfile
from apps.main.services.report_reference_catalog import get_report_reference
from apps.main.services.report_trace_specs import DESIGN_PARAMETER_SPECS, get_component_trace_specs
from apps.main.services.rigging import RiggingDesignService


class RiggingDesignReportPreviewService:
    """Build a report-specific payload for the editorial report preview."""

    ARRANGEMENT_SKETCHS = {
        1: "images/lifting_arrangements/one_point_lifting_sketch.jpg",
        2: "images/lifting_arrangements/two_point_lifting_sketch.jpg",
        3: "images/lifting_arrangements/three_point_lifting_sketch.jpg",
        4: "images/lifting_arrangements/four_point_lifting_sketch.jpg",
    }

    @classmethod
    def build_payload(cls, design: RiggingDesign, request=None, selected_key: Optional[str] = None) -> Dict[str, Any]:
        results = RiggingDesignService.build_detail_results(design)
        profile, _ = UserProfile.objects.get_or_create(user=design.project.owner)

        selected_key, selected_combination = cls._select_combination(
            results.get("optimal_combinations"),
            selected_key=selected_key,
        )
        selected_items = cls._normalize_items((selected_combination or {}).get("items"))
        factor_entries = cls._normalize_component_entries((selected_combination or {}).get("component_factors"))
        trace_entries = cls._normalize_component_entries((selected_combination or {}).get("component_traces"))
        component_rows = cls._align_component_rows(selected_items, factor_entries, trace_entries)
        compatibility_details = cls._normalize_sequence((selected_combination or {}).get("compatibility_details"))

        project = design.project
        analysis = design.analysis
        context = results.get("calculation_context") or {}
        summary = results.get("summary") or {}
        warnings = cls._collect_warnings(results.get("optimal_combinations"))
        issued_at = timezone.now()

        return {
            "header": {
                "title": "Rigging Engineering Report",
                "subtitle": "Recommendation preview for client-ready issue",
                "project_name": getattr(project, "name", ""),
                "analysis_name": getattr(analysis, "name", "") if analysis else "Manual design",
                "design_name": design.name or f"Rigging Design {design.id}",
                "company_name": profile.company or "Issuing company not configured",
                "company_logo_url": cls._file_url(profile.company_logo, request),
                "prepared_by": cls._prepared_by(profile, project.owner),
                "issued_date": issued_at.date().isoformat(),
                "issued_datetime": issued_at.isoformat(),
                "report_number": cls._build_report_number(design),
                "revision": f"R{design.version:02d}",
                "produced_with": "Produced with Grispen Rigging SaaS",
            },
            "available_combinations": cls._build_available_combinations(results.get("optimal_combinations")),
            "recommendation": {
                "selected_key": selected_key,
                "selected_title": cls._combination_title(selected_key),
                "status": design.status,
                "is_active": design.is_active,
                "arrangement": design.arrangement or [],
                "governing_result": cls._governing_result(selected_items),
                "overall_compatible": (selected_combination or {}).get("overall_compatible"),
                "warning_messages": warnings[:3],
                "critical_notes": cls._critical_notes(selected_combination, warnings),
                "key_metrics": cls._build_key_metrics(results),
            },
            "project_context": {
                "project_description": getattr(project, "description", ""),
                "location": getattr(analysis, "location", None) if analysis else None,
                "lifting_points_qty": summary.get("lifting_points_qty") or getattr(analysis, "lifting_points_qty", None),
                "created_at": design.created_at.isoformat(),
                "updated_at": design.updated_at.isoformat(),
            },
            "design_basis": {
                "loads": cls._build_load_basis(context),
                "factors": cls._build_factor_basis(context),
                "arrangement": cls._build_arrangement_basis(design.arrangement or []),
            },
            "selected_components": {
                "items": cls._build_component_schedule(selected_items),
                "sling_lengths": cls._build_sling_lengths(results.get("sling_lengths")),
                "visuals": {
                    "arrangement_sketch_url": cls._arrangement_sketch_url(
                        summary.get("lifting_points_qty") or getattr(analysis, "lifting_points_qty", None),
                        request,
                    ),
                },
            },
            "governing_checks": cls._build_governing_checks(component_rows),
            "compatibility_summary": {
                "overall_compatible": (selected_combination or {}).get("overall_compatible"),
                "geometric_warning": (selected_combination or {}).get("geometric_warning"),
                "warning_message": (selected_combination or {}).get("warning_message"),
                "details": compatibility_details,
            },
            "notes": {
                "assumptions": [
                    "This preview is generated from the currently saved design state.",
                    "Prepared-by and company identity are sourced from the account profile.",
                    "Final engineering issue should verify configuration inputs and selected combination before release.",
                ],
                "limitations": [
                    "This report preview is intended to support issue-ready review before PDF export.",
                    "Engineering responsibility remains with the issuing company and reviewer.",
                ],
            },
            "appendix": {
                "warnings": warnings,
                "other_combinations": cls._build_other_combinations(results.get("optimal_combinations"), selected_key),
                "component_factors": cls._appendix_component_factors(component_rows),
                "component_traces": cls._appendix_component_traces(component_rows, context, request=request),
                "compatibility_details": cls._build_appendix_compatibility_details(compatibility_details),
            },
        }

    @staticmethod
    def _file_url(file_field, request=None) -> Optional[str]:
        if not file_field:
            return None

        url = file_field.url
        if request:
            return request.build_absolute_uri(url)
        return url

    @staticmethod
    def _prepared_by(profile: UserProfile, user) -> str:
        if profile.report_prepared_by:
            return profile.report_prepared_by
        full_name = f"{user.first_name} {user.last_name}".strip()
        if full_name:
            return full_name
        return user.username or user.email

    @staticmethod
    def _build_report_number(design: RiggingDesign) -> str:
        project_token = str(design.project_id).split("-")[0].upper()
        design_token = str(design.id).split("-")[0].upper()
        return f"GR-{project_token}-{design_token}-V{design.version:02d}"

    @classmethod
    def _arrangement_sketch_url(cls, lifting_points_qty: Optional[int], request=None) -> Optional[str]:
        if not lifting_points_qty:
            return None
        path = cls.ARRANGEMENT_SKETCHS.get(int(lifting_points_qty))
        if not path:
            return None
        url = static(path)
        if request:
            return request.build_absolute_uri(url)
        return url

    @staticmethod
    def _select_combination(optimal_combinations: Any, selected_key: Optional[str] = None) -> Tuple[str, Dict[str, Any]]:
        combinations = optimal_combinations if isinstance(optimal_combinations, dict) else {}
        if selected_key:
            combo = combinations.get(selected_key)
            if isinstance(combo, dict) and combo:
                return selected_key, combo
        for key in ("user_specified", "conservative", "minimum"):
            combo = combinations.get(key)
            if isinstance(combo, dict) and combo:
                return key, combo
        return "none", {}

    @staticmethod
    def _combination_title(key: str) -> str:
        titles = {
            "user_specified": "User-Specified Recommendation",
            "conservative": "Conservative Recommendation",
            "minimum": "Minimum Recommendation",
            "none": "No Recommendation Available",
        }
        return titles.get(key, key.replace("_", " ").title())

    @staticmethod
    def _normalize_sequence(value: Any) -> List[Any]:
        if isinstance(value, list):
            return value
        if isinstance(value, tuple):
            return list(value)
        if isinstance(value, dict):
            return list(value.values())
        return []

    @staticmethod
    def _normalize_items(value: Any) -> List[Dict[str, Any]]:
        return [
            item for item in RiggingDesignReportPreviewService._normalize_sequence(value)
            if isinstance(item, dict)
        ]

    @staticmethod
    def _normalize_component_entries(value: Any) -> List[Dict[str, Any]]:
        if isinstance(value, dict):
            entries: List[Dict[str, Any]] = []
            for key, item in value.items():
                if not isinstance(item, dict):
                    continue
                entry = dict(item)
                meta = entry.get("meta") if isinstance(entry.get("meta"), dict) else {}
                if entry.get("position") is None and meta.get("position") is None:
                    try:
                        entry["position"] = int(key)
                    except (TypeError, ValueError):
                        pass
                entries.append(entry)
            return entries

        return [
            entry for entry in RiggingDesignReportPreviewService._normalize_sequence(value)
            if isinstance(entry, dict)
        ]

    @staticmethod
    def _normalize_position_map(value: Any) -> Dict[str, Dict[str, Any]]:
        if isinstance(value, dict):
            normalized: Dict[str, Dict[str, Any]] = {}
            for key, item in value.items():
                if isinstance(item, dict):
                    normalized[str(key)] = item
            return normalized

        normalized = {}
        for item in RiggingDesignReportPreviewService._normalize_sequence(value):
            if not isinstance(item, dict):
                continue
            position = item.get("position")
            if position is None and isinstance(item.get("meta"), dict):
                position = item["meta"].get("position")
            if position is None:
                continue
            normalized[str(position)] = item
        return normalized

    @staticmethod
    def _entry_position(entry: Dict[str, Any]) -> Optional[int]:
        position = entry.get("position")
        if position is None and isinstance(entry.get("meta"), dict):
            position = entry["meta"].get("position")
        if position is None:
            return None
        try:
            return int(position)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _entry_component_type(entry: Dict[str, Any]) -> Optional[str]:
        component_type = entry.get("component_type")
        if component_type is None and isinstance(entry.get("meta"), dict):
            component_type = entry["meta"].get("component_type")
        return str(component_type) if component_type else None

    @staticmethod
    def _entry_component_id(entry: Dict[str, Any]) -> Optional[str]:
        component_id = entry.get("component_id")
        if component_id is None and isinstance(entry.get("meta"), dict):
            component_id = entry["meta"].get("component_id")
        return str(component_id) if component_id is not None else None

    @classmethod
    def _match_component_entry(
        cls,
        item: Dict[str, Any],
        index: int,
        entries: List[Dict[str, Any]],
        used_indexes: set[int],
    ) -> Tuple[Dict[str, Any], Optional[int]]:
        if not entries:
            return {}, None

        item_position = cls._entry_position(item)
        item_component_type = cls._entry_component_type(item)
        item_component_id = cls._entry_component_id(item)

        for entry_index, entry in enumerate(entries):
            if entry_index in used_indexes:
                continue
            if item_position is not None and cls._entry_position(entry) == item_position:
                return entry, entry_index

        for entry_index, entry in enumerate(entries):
            if entry_index in used_indexes:
                continue
            if item_component_id and cls._entry_component_id(entry) == item_component_id:
                return entry, entry_index

        if index < len(entries) and index not in used_indexes:
            entry = entries[index]
            entry_component_type = cls._entry_component_type(entry)
            if entry_component_type in (None, item_component_type):
                return entry, index

        for entry_index, entry in enumerate(entries):
            if entry_index in used_indexes:
                continue
            if item_component_type and cls._entry_component_type(entry) == item_component_type:
                return entry, entry_index

        for entry_index, entry in enumerate(entries):
            if entry_index not in used_indexes:
                return entry, entry_index

        return {}, None

    @classmethod
    def _align_component_rows(
        cls,
        items: List[Dict[str, Any]],
        factor_entries: List[Dict[str, Any]],
        trace_entries: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        rows = []
        used_factor_indexes: set[int] = set()
        used_trace_indexes: set[int] = set()

        for index, item in enumerate(items):
            factor_entry, factor_index = cls._match_component_entry(item, index, factor_entries, used_factor_indexes)
            trace_entry, trace_index = cls._match_component_entry(item, index, trace_entries, used_trace_indexes)

            if factor_index is not None:
                used_factor_indexes.add(factor_index)
            if trace_index is not None:
                used_trace_indexes.add(trace_index)

            rows.append({
                "position": item.get("display_position") or item.get("position"),
                "component_position": item.get("position"),
                "component_id": item.get("component_id"),
                "component_type": item.get("component_type"),
                "item": item,
                "factor": factor_entry or {},
                "trace": trace_entry or {},
            })

        return rows

    @staticmethod
    def _governing_result(items: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not items:
            return {
                "label": "No governing component",
                "utilization": None,
                "status": "unknown",
            }

        governing = max(items, key=lambda item: float(item.get("utilization") or 0))
        utilization = governing.get("utilization")
        utilization_value = float(utilization or 0)
        if utilization_value > 1:
            status = "fail"
        elif utilization_value > 0.9:
            status = "warning"
        else:
            status = "pass"

        return {
            "label": f"Position {governing.get('display_position') or governing.get('position', '-')}",
            "component_type": governing.get("component_type"),
            "utilization": utilization,
            "status": status,
        }

    @staticmethod
    def _critical_notes(selected_combination: Dict[str, Any], warnings: List[str]) -> List[str]:
        notes = []
        if selected_combination.get("warning_message"):
            notes.append(selected_combination["warning_message"])
        if selected_combination.get("geometric_warning"):
            notes.append(selected_combination["geometric_warning"])
        for warning in warnings:
            if warning not in notes:
                notes.append(warning)
        return notes[:4]

    @staticmethod
    def _build_key_metrics(results: Dict[str, Any]) -> List[Dict[str, Any]]:
        context = results.get("calculation_context") or {}
        summary = results.get("summary") or {}
        static_loads = (context.get("static") or {})
        dynamic_loads = (context.get("dynamic") or {})
        dnv_factors = context.get("dnv_factors") or {}
        units = context.get("units") or {}
        load_unit = units.get("load")

        return [
            {
                "label": "Lifting Points",
                "value": summary.get("lifting_points_qty"),
                "unit": None,
            },
            {
                "label": "DAF",
                "value": dnv_factors.get("dynamic_amplification_factor"),
                "unit": None,
            },
            {
                "label": "Static Hook Load",
                "value": static_loads.get("hook_load"),
                "unit": load_unit,
            },
            {
                "label": "Dynamic Hook Load",
                "value": dynamic_loads.get("hook_load"),
                "unit": load_unit,
            },
            {
                "label": "Controlling Static Sling Load",
                "value": static_loads.get("controlling_sling_load"),
                "unit": load_unit,
            },
            {
                "label": "Controlling Dynamic Sling Load",
                "value": dynamic_loads.get("controlling_sling_load"),
                "unit": load_unit,
            },
        ]

    @staticmethod
    def _build_load_basis(context: Dict[str, Any]) -> List[Dict[str, Any]]:
        static_loads = context.get("static") or {}
        dynamic_loads = context.get("dynamic") or {}
        units = context.get("units") or {}
        load_unit = units.get("load")
        return [
            {"label": "Static Hook Load", "value": static_loads.get("hook_load"), "unit": load_unit},
            {"label": "Dynamic Hook Load", "value": dynamic_loads.get("hook_load"), "unit": load_unit},
            {"label": "Controlling Static Sling Load", "value": static_loads.get("controlling_sling_load"), "unit": load_unit},
            {"label": "Controlling Dynamic Sling Load", "value": dynamic_loads.get("controlling_sling_load"), "unit": load_unit},
        ]

    @staticmethod
    def _build_factor_basis(context: Dict[str, Any]) -> List[Dict[str, Any]]:
        factors = context.get("dnv_factors") or {}
        labels = {
            "weight_factor": "Weight Factor",
            "rigging_weight_factor": "Rigging Weight Factor",
            "cog_factor": "COG Factor",
            "yaw_factor": "Yaw Factor",
            "skew_load_factor": "Skew Load Factor",
            "dynamic_amplification_factor": "Dynamic Amplification Factor",
        }
        return [
            {"label": labels.get(key, key.replace("_", " ").title()), "value": value, "unit": None}
            for key, value in factors.items()
        ]

    @staticmethod
    def _build_arrangement_basis(arrangement: Iterable[str]) -> List[Dict[str, Any]]:
        return [
            {"position": index + 1, "component_type": component}
            for index, component in enumerate(arrangement or [])
        ]

    @staticmethod
    def _build_component_schedule(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        schedule = []
        for item in items:
            component_type = item.get("component_type")
            descriptor_parts = [item.get("manufacturer"), item.get("model")]
            if component_type == "WireRope":
                descriptor_parts = [
                    item.get("configuration"),
                    item.get("termination"),
                    item.get("eye_type"),
                ]

            schedule.append({
                "position": item.get("display_position") or item.get("position"),
                "component_type": component_type,
                "designation": " / ".join(str(part) for part in descriptor_parts if part) or component_type,
                "capacity": item.get("wll_or_mbl"),
                "capacity_label": "MBL" if component_type == "WireRope" else "WLL",
                "utilization": item.get("utilization"),
                "status": RiggingDesignReportPreviewService._utilization_status(item.get("utilization")),
            })
        return schedule

    @staticmethod
    def _build_sling_lengths(sling_lengths: Any) -> List[Dict[str, Any]]:
        if not isinstance(sling_lengths, list):
            return []

        rows = []
        for index, length in enumerate(sling_lengths):
            rows.append({
                "leg": index + 1,
                "length": length if isinstance(length, (int, float)) else None,
                "unit": "m",
            })
        return rows

    @staticmethod
    def _utilization_status(utilization: Any) -> str:
        value = float(utilization or 0)
        if value > 1:
            return "fail"
        if value > 0.9:
            return "warning"
        return "pass"

    @classmethod
    def _build_governing_checks(
        cls,
        component_rows: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        checks = []
        for row in component_rows:
            item = row.get("item") or {}
            factors = row.get("factor") or {}
            traces = row.get("trace") or {}
            controlling_check = ((traces.get("results") or {}).get("controlling_check")) if isinstance(traces, dict) else None
            checks.append({
                "position": row.get("position"),
                "component_type": row.get("component_type"),
                "utilization": item.get("utilization"),
                "status": cls._utilization_status(item.get("utilization")),
                "controlling_check": controlling_check,
                "minimum_breaking_load": factors.get("minimum_breaking_load"),
                "proof_load": factors.get("proof_load"),
                "nominal_safety_factor": factors.get("nominal_safety_factor") or factors.get("minimum_safety_factor"),
            })
        return checks

    @staticmethod
    def _collect_warnings(optimal_combinations: Any) -> List[str]:
        warnings: List[str] = []
        combinations = optimal_combinations if isinstance(optimal_combinations, dict) else {}
        for combo in combinations.values():
            if not isinstance(combo, dict):
                continue
            for field in ("warning_message", "geometric_warning"):
                value = combo.get(field)
                if value and value not in warnings:
                    warnings.append(value)
        return warnings

    @classmethod
    def _build_other_combinations(cls, optimal_combinations: Any, selected_key: str) -> List[Dict[str, Any]]:
        combinations = optimal_combinations if isinstance(optimal_combinations, dict) else {}
        items = []
        for key, combo in combinations.items():
            if key == selected_key or not isinstance(combo, dict) or not combo:
                continue
            combo_items = cls._normalize_items(combo.get("items"))
            governing = cls._governing_result(combo_items)
            items.append({
                "key": key,
                "title": cls._combination_title(key),
                "overall_compatible": combo.get("overall_compatible"),
                "governing_result": governing,
                "warning_message": combo.get("warning_message"),
            })
        return items

    @classmethod
    def _build_available_combinations(cls, optimal_combinations: Any) -> List[Dict[str, str]]:
        combinations = optimal_combinations if isinstance(optimal_combinations, dict) else {}
        items = []
        for key in ("user_specified", "conservative", "minimum"):
            combo = combinations.get(key)
            if isinstance(combo, dict) and combo:
                items.append({
                    "key": key,
                    "title": cls._combination_title(key),
                })
        return items

    @classmethod
    def _appendix_component_factors(
        cls,
        component_rows: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        rows = []
        for row in component_rows:
            item = row.get("item") or {}
            factor = row.get("factor") or {}
            display_values, metadata = cls._split_factor_fields(factor)
            rows.append({
                "position": row.get("position"),
                "component_id": row.get("component_id"),
                "component_type": row.get("component_type"),
                "utilization": item.get("utilization"),
                "display_values": display_values,
                "metadata": metadata,
            })
        return rows

    @classmethod
    def _appendix_component_traces(
        cls,
        component_rows: List[Dict[str, Any]],
        context: Dict[str, Any],
        request=None,
    ) -> Dict[str, Any]:
        used_reference_ids: set[str] = set()
        component_sections = []

        for row in component_rows:
            section = cls._build_component_trace_section(row, request=request)
            component_sections.append(section)
            used_reference_ids.update(cls._collect_trace_reference_ids(section.get("rows")))

        design_parameters = cls._build_design_parameters_section(context)
        used_reference_ids.update(cls._collect_trace_reference_ids(design_parameters.get("rows")))

        references = []
        for reference_id in sorted(used_reference_ids, key=cls._reference_sort_key):
            reference = get_report_reference(reference_id)
            if reference:
                references.append(reference)

        return {
            "design_parameters": design_parameters,
            "components": component_sections,
            "references": references,
        }

    @classmethod
    def _build_design_parameters_section(cls, context: Dict[str, Any]) -> Dict[str, Any]:
        rows = []
        for spec in DESIGN_PARAMETER_SPECS:
            value = cls._nested_value(context, spec.get("context_path") or ())
            if value in (None, ""):
                continue
            unit = cls._nested_value(context, spec.get("unit_path") or ()) if spec.get("unit_path") else None
            row = cls._build_trace_row(
                key=str(spec.get("key") or ""),
                label=str(spec.get("label") or ""),
                category=str(spec.get("category") or "input"),
                value=value,
                unit=unit,
                variable_symbol=spec.get("variable_symbol"),
                formula_latex=spec.get("formula_latex"),
                text_fallback=spec.get("text_fallback"),
                citations=spec.get("citations"),
                highlight_result=bool(spec.get("highlight_result")),
            )
            rows.append(row)

        return {
            "title": "Design Parameters",
            "rows": rows,
        }

    @classmethod
    def _build_component_trace_section(cls, row: Dict[str, Any], request=None) -> Dict[str, Any]:
        item = row.get("item") or {}
        trace = row.get("trace") or {}
        component_type = row.get("component_type") or item.get("component_type")
        used_keys: Dict[str, set[str]] = {
            "inputs": set(),
            "factors": set(),
            "intermediates": set(),
            "checks": set(),
            "results": set(),
        }
        rows = []

        for spec in get_component_trace_specs(component_type):
            trace_entry = cls._trace_entry(trace, str(spec.get("section") or ""), str(spec.get("key") or ""))
            if not trace_entry or trace_entry.get("value") in (None, ""):
                continue

            rows.append(
                cls._build_trace_row(
                    key=str(spec.get("key") or ""),
                    label=str(spec.get("label") or cls._field_label(str(spec.get("key") or ""))),
                    category=str(spec.get("category") or "note"),
                    value=trace_entry.get("value"),
                    unit=trace_entry.get("unit"),
                    variable_symbol=spec.get("variable_symbol"),
                    formula_latex=spec.get("formula_latex"),
                    text_fallback=spec.get("text_fallback") or trace_entry.get("eqn") or trace_entry.get("note"),
                    citations=spec.get("citations"),
                    highlight_result=bool(spec.get("highlight_result")),
                )
            )
            used_keys.setdefault(str(spec.get("section") or ""), set()).add(str(spec.get("key") or ""))

        rows.extend(cls._build_unmapped_trace_rows(trace, used_keys))

        capacity = item.get("wll_or_mbl")
        if capacity in (None, ""):
            capacity = cls._fallback_component_capacity(item, trace)

        return {
            "position": item.get("display_position") or row.get("position"),
            "component_type": component_type,
            "manufacturer": item.get("manufacturer"),
            "model": item.get("model"),
            "capacity": capacity,
            "capacity_unit": "Te" if capacity not in (None, "") else None,
            "header_title": cls._component_trace_header_title(item, row, capacity),
            "image_url": cls._component_image_url(component_type, request=request),
            "rows": rows,
        }

    @classmethod
    def _build_unmapped_trace_rows(
        cls,
        trace: Dict[str, Any],
        used_keys: Dict[str, set[str]],
    ) -> List[Dict[str, Any]]:
        rows = []
        for section_name in ("inputs", "factors", "intermediates", "checks", "results"):
            section = trace.get(section_name)
            if not isinstance(section, dict):
                continue

            used_section_keys = used_keys.get(section_name, set())
            for key, value in section.items():
                if key in used_section_keys or value in (None, ""):
                    continue

                trace_entry = value if isinstance(value, dict) else {"value": value}
                rows.append(
                    cls._build_trace_row(
                        key=key,
                        label=cls._field_label(key),
                        category="note" if section_name == "results" else section_name[:-1] if section_name.endswith("s") else section_name,
                        value=trace_entry.get("value"),
                        unit=trace_entry.get("unit"),
                        variable_symbol=None,
                        formula_latex=None,
                        text_fallback=trace_entry.get("eqn") or trace_entry.get("note"),
                        citations=[],
                        highlight_result=False,
                    )
                )

        return rows

    @staticmethod
    def _trace_entry(trace: Dict[str, Any], section: str, key: str) -> Optional[Dict[str, Any]]:
        if not isinstance(trace, dict):
            return None

        trace_section = trace.get(section)
        if not isinstance(trace_section, dict):
            return None

        value = trace_section.get(key)
        if value is None:
            return None
        if isinstance(value, dict):
            return value
        return {
            "value": value,
            "unit": None,
            "source": None,
            "eqn": None,
            "note": None,
        }

    @classmethod
    def _build_trace_row(
        cls,
        key: str,
        label: str,
        category: str,
        value: Any,
        unit: Any = None,
        variable_symbol: Any = None,
        formula_latex: Any = None,
        text_fallback: Any = None,
        citations: Any = None,
        highlight_result: bool = False,
    ) -> Dict[str, Any]:
        value_kind = cls._trace_value_kind(value)
        return {
            "key": key,
            "label": label,
            "category": category,
            "value": value,
            "unit": unit,
            "value_kind": value_kind,
            "variable_latex": cls._build_variable_latex(variable_symbol, value, unit, value_kind),
            "formula_latex": formula_latex,
            "text_fallback": text_fallback,
            "citations": list(citations or []),
            "highlight_result": highlight_result,
        }

    @staticmethod
    def _trace_value_kind(value: Any) -> str:
        if isinstance(value, bool):
            return "boolean"
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return "number"
        return "text"

    @classmethod
    def _build_variable_latex(
        cls,
        variable_symbol: Any,
        value: Any,
        unit: Any,
        value_kind: str,
    ) -> Optional[str]:
        if not variable_symbol or value in (None, ""):
            return None

        symbol = str(variable_symbol)
        if value_kind == "number":
            formatted = cls._format_decimal(value)
            if unit and unit not in ("-", ""):
                return rf"{symbol} = {formatted}\ \mathrm{{{cls._latex_escape_text(str(unit))}}}"
            return rf"{symbol} = {formatted}"

        if value_kind == "boolean":
            text_value = "Yes" if value else "No"
        else:
            text_value = cls._humanize_report_text(str(value))

        return rf"{symbol} = \text{{{cls._latex_escape_text(text_value)}}}"

    @staticmethod
    def _latex_escape_text(value: str) -> str:
        replacements = {
            "\\": r"\backslash ",
            "{": r"\{",
            "}": r"\}",
            "_": r"\_",
            "%": r"\%",
            "&": r"\&",
            "#": r"\#",
            "$": r"\$",
        }
        escaped = value
        for source, target in replacements.items():
            escaped = escaped.replace(source, target)
        return escaped

    @staticmethod
    def _format_decimal(value: Any) -> str:
        try:
            return f"{float(value):.2f}"
        except (TypeError, ValueError):
            return str(value)

    @classmethod
    def _humanize_report_text(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            return value
        if re.fullmatch(r"[A-Z0-9]+", trimmed):
            return trimmed
        if re.fullmatch(r"[a-z0-9_]+", trimmed):
            return trimmed.replace("_", " ").title()
        return re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", trimmed).replace("_", " ")

    @staticmethod
    def _nested_value(data: Dict[str, Any], path: Iterable[str]) -> Any:
        current: Any = data
        for key in path:
            if not isinstance(current, dict):
                return None
            current = current.get(key)
        return current

    @staticmethod
    def _collect_trace_reference_ids(rows: Any) -> set[str]:
        reference_ids: set[str] = set()
        if not isinstance(rows, list):
            return reference_ids
        for row in rows:
            if not isinstance(row, dict):
                continue
            for citation in row.get("citations") or []:
                if not isinstance(citation, dict):
                    continue
                reference_id = citation.get("reference_id")
                if reference_id not in (None, ""):
                    reference_ids.add(str(reference_id))
        return reference_ids

    @staticmethod
    def _reference_sort_key(reference_id: str) -> tuple[int, str]:
        try:
            return 0, f"{int(reference_id):08d}"
        except (TypeError, ValueError):
            return 1, str(reference_id)

    @classmethod
    def _component_trace_header_title(
        cls,
        item: Dict[str, Any],
        row: Dict[str, Any],
        capacity: Any,
    ) -> str:
        display_position = item.get("display_position") or row.get("position") or "-"
        component_type = cls._humanize_report_text(str(row.get("component_type") or item.get("component_type") or "Component"))
        descriptor_parts = [
            str(part).strip()
            for part in (item.get("manufacturer"), item.get("model"))
            if part not in (None, "")
        ]
        if capacity not in (None, ""):
            descriptor_parts.append(f"{cls._format_decimal(capacity)} Te")

        suffix = f", {' '.join(descriptor_parts)}" if descriptor_parts else ""
        return f"Item {display_position}: {component_type}{suffix}"

    @classmethod
    def _fallback_component_capacity(cls, item: Dict[str, Any], trace: Dict[str, Any]) -> Any:
        if item.get("component_type") == "WireRope":
            wire_rope_capacity = cls._nested_value(trace, ("intermediates", "effective_MBL", "value"))
            if wire_rope_capacity not in (None, ""):
                return wire_rope_capacity
            return cls._nested_value(trace, ("inputs", "MBL", "value"))

        for path in (
            ("inputs", "WLL", "value"),
            ("inputs", "SWL", "value"),
            ("inputs", "SWL_masterlink", "value"),
            ("inputs", "SWL_assembly", "value"),
        ):
            capacity = cls._nested_value(trace, path)
            if capacity not in (None, ""):
                return capacity
        return None

    @classmethod
    def _component_image_url(cls, component_type: Optional[str], request=None) -> Optional[str]:
        image_map = {
            "Masterlink": "images/components/masterlink.png",
            "MasterlinkAssembly": "images/components/masterlink-assembly.png",
            "WireRope": "images/components/wire-rope.png",
            "Shackle": "images/components/shackle.png",
        }
        relative_path = image_map.get(component_type or "")
        if not relative_path:
            return None

        app_root = Path(__file__).resolve().parents[1]
        file_path = app_root / "static" / Path(relative_path)
        if not file_path.exists():
            return None

        url = static(relative_path)
        if request:
            return request.build_absolute_uri(url)
        return url

    @classmethod
    def _build_appendix_compatibility_details(cls, details: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        rows = []
        for detail in details:
            if not isinstance(detail, dict):
                continue
            first = detail.get("first_component_dict") or {}
            second = detail.get("second_component_dict") or {}
            rows.append({
                "pair": f"{cls._compatibility_component_label(first)} -> {cls._compatibility_component_label(second)}",
                "compatible": detail.get("compatible"),
                "reason": detail.get("reason"),
                "first_component": first,
                "second_component": second,
            })
        return rows

    @classmethod
    def _split_factor_fields(cls, factor: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        display_values: List[Dict[str, Any]] = []
        metadata: List[Dict[str, Any]] = []

        for key, value in factor.items():
            field = {
                "key": key,
                "label": cls._field_label(key),
                "value": value,
                "kind": cls._field_kind(value),
            }
            if cls._is_metadata_field(key, value):
                metadata.append(field)
            else:
                display_values.append(field)

        return display_values, metadata

    @staticmethod
    def _field_label(key: str) -> str:
        return key.replace("_", " ").title()

    @staticmethod
    def _field_kind(value: Any) -> str:
        if isinstance(value, bool):
            return "boolean"
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return "number"
        if isinstance(value, (dict, list, tuple)):
            return "structured"
        return "text"

    @staticmethod
    def _is_metadata_field(key: str, value: Any) -> bool:
        if key.endswith("_id") or key == "id":
            return True
        if isinstance(value, dict):
            value_keys = set(value.keys())
            if {"type", "id"}.issubset(value_keys):
                return True
        return False

    @staticmethod
    def _compatibility_component_label(component: Dict[str, Any]) -> str:
        component_type = component.get("component_type") or "Component"
        component_id = component.get("component_id")
        if component_id is None:
            return str(component_type)
        return f"{component_type} ({component_id})"
