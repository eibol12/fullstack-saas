from typing import Dict, Any, Optional, Tuple
import logging

from django.db import transaction
import csv
import io

from apps.main.models import (
    LiftingAnalysis, Project, RiggingDesign,
    Shackle, Masterlink, MasterlinkAssembly,
    WireRope
)
from domain.rigging.design import RiggingDesigner
from domain.rigging.engine import design as design_rigging
from domain.rigging.errors import RiggingDesignInputError
from domain.rigging.types import (
    RiggingAnalysisInput,
    RiggingAnalysisResults,
    RiggingDesignInput,
    UserPreferencesDTO,
)
from domain.utils.exceptions import DomainValidationError
from domain.rigging.mappers import enrich_rigging_results
from infrastructure.rigging.repositories import DjangoRiggingRepository
from apps.main.services.lifting import LiftingAnalysisService
from django.db import IntegrityError


rigging_logger = logging.getLogger("lifting.design")


class RiggingDesignService:
    """Service layer for orchestrating design design workflows using the domain entrypoint.

    Provides:
     - Input validation and user preference resolution (IDs/types -> model instances).
     - Running design for a given LiftingAnalysis.
     - Running design directly from manual inputs (no analysis).
     - Persistence to RiggingDesign model with versioning and active flag management.
     - Retrieval, listing, activation, and export helpers.

    All public methods emit structured logs via logger name 'lifting.design'.
    """

    # -----------------
    # Validation helpers
    # -----------------
    @staticmethod
    def _analysis_to_input_payload(analysis: LiftingAnalysis) -> RiggingAnalysisInput:
        """Build the RiggingAnalysisInput DTO for a LiftingAnalysis."""
        analysis_data = {
            "lifting_points_qty": getattr(analysis, "lifting_points_qty", None),
            "results": getattr(analysis, "results", None),
            "configuration": getattr(analysis, "configuration", None),
        }
        return RiggingDesignService._parse_analysis_input(analysis_data)

    @staticmethod
    def _parse_analysis_input(analysis_data: Dict[str, Any]) -> RiggingAnalysisInput:
        """Convert analysis_data dict into RiggingAnalysisInput, enforcing required fields."""
        if not isinstance(analysis_data, dict):
            raise RiggingDesignInputError("analysis_data must be a dictionary")

        if "lifting_points_qty" not in analysis_data:
            raise RiggingDesignInputError("Missing analysis_data.lifting_points_qty")
        lpq = analysis_data["lifting_points_qty"]
        try:
            lpq = int(lpq)
        except (TypeError, ValueError):
            raise RiggingDesignInputError("lifting_points_qty must be an integer between 1 and 4")
        if lpq < 1 or lpq > 4:
            raise RiggingDesignInputError("lifting_points_qty must be an integer between 1 and 4")

        if "configuration" not in analysis_data:
            raise RiggingDesignInputError("Missing analysis_data.configuration")
        configuration = analysis_data["configuration"]
        if not isinstance(configuration, dict):
            raise RiggingDesignInputError("analysis_data.configuration must be a dictionary")

        if "results" not in analysis_data:
            raise RiggingDesignInputError("Missing analysis_data.results")
        results = analysis_data["results"]
        if not isinstance(results, dict):
            raise RiggingDesignInputError("analysis_data.results must be a dictionary")

        factors = results.get("factors")
        if not isinstance(factors, dict) or not factors:
            raise RiggingDesignInputError("Missing or invalid results.factors")
        parsed_factors: Dict[str, float] = {}
        for key, value in factors.items():
            try:
                parsed_factors[str(key)] = float(value)
            except (TypeError, ValueError):
                raise RiggingDesignInputError(f"results.factors[{key}] must be a number")

        static_results = results.get("static_results")
        if not isinstance(static_results, dict):
            raise RiggingDesignInputError("Missing or invalid results.static_results")
        dynamic_results = results.get("dynamic_results")
        if not isinstance(dynamic_results, dict):
            raise RiggingDesignInputError("Missing or invalid results.dynamic_results")

        if "hook_load" not in static_results:
            raise RiggingDesignInputError("Missing results.static_results.hook_load")
        if "static_sling_loads" not in static_results:
            raise RiggingDesignInputError("Missing results.static_results.static_sling_loads")
        if "hook_load" not in dynamic_results:
            raise RiggingDesignInputError("Missing results.dynamic_results.hook_load")
        if "dynamic_sling_loads" not in dynamic_results:
            raise RiggingDesignInputError("Missing results.dynamic_results.dynamic_sling_loads")

        try:
            static_hook_load = float(static_results["hook_load"])
        except (TypeError, ValueError):
            raise RiggingDesignInputError("results.static_results.hook_load must be a number")
        try:
            dynamic_hook_load = float(dynamic_results["hook_load"])
        except (TypeError, ValueError):
            raise RiggingDesignInputError("results.dynamic_results.hook_load must be a number")

        static_sling_loads = RiggingDesignService._parse_sling_loads(
            "results.static_results.static_sling_loads",
            static_results["static_sling_loads"],
        )
        dynamic_sling_loads = RiggingDesignService._parse_sling_loads(
            "results.dynamic_results.dynamic_sling_loads",
            dynamic_results["dynamic_sling_loads"],
        )

        return RiggingAnalysisInput(
            lifting_points_qty=lpq,
            configuration=configuration,
            results=RiggingAnalysisResults(
                factors=parsed_factors,
                static_hook_load=static_hook_load,
                static_sling_loads=static_sling_loads,
                dynamic_hook_load=dynamic_hook_load,
                dynamic_sling_loads=dynamic_sling_loads,
            ),
        )

    @staticmethod
    def _parse_sling_loads(field_name: str, payload: Any) -> Dict[int, float]:
        if not isinstance(payload, dict):
            raise RiggingDesignInputError(f"{field_name} must be a dictionary")
        parsed: Dict[int, float] = {}
        for key, value in payload.items():
            try:
                idx = int(key)
            except (TypeError, ValueError):
                raise RiggingDesignInputError(f"{field_name} keys must be integers")
            try:
                parsed[idx] = float(value)
            except (TypeError, ValueError):
                raise RiggingDesignInputError(f"{field_name}[{key}] must be a number")
        return parsed

    @staticmethod
    def _get_repository() -> DjangoRiggingRepository:
        return DjangoRiggingRepository()

    @staticmethod
    def build_detail_results(design: RiggingDesign) -> Dict[str, Any]:
        """Prepare view-friendly results without embedding domain calculations in the view."""
        rope_lengths = (design.results or {}).get("sling_lengths")
        if not isinstance(rope_lengths, list):
            raise ValueError(
                "RiggingDesign.results is missing 'sling_lengths'. "
                "This design was likely created before sling lengths were persisted."
            )

        repository = RiggingDesignService._get_repository()
        return enrich_rigging_results(design.results or {}, repository, rope_lengths)

    @staticmethod
    def _get_component_model(component_type: str):
        mapping = {
            "Shackle": Shackle,
            "Masterlink": Masterlink,
            "MasterlinkAssembly": MasterlinkAssembly,
            "WireRope": WireRope,
            # "FibreSling": FibreSling,
            # "Grommet": Grommet,
        }
        return mapping.get(component_type)

    @staticmethod
    def _parse_user_preferences_dto(
        user_preferences: Optional[Dict[Any, Dict[str, Any]]],
    ) -> UserPreferencesDTO:
        """Parse raw user preference payload into the JSON-native DTO structure."""
        parsed: UserPreferencesDTO = {}
        if not user_preferences:
            return parsed
        if isinstance(user_preferences, list):
            user_preferences = {
                idx: pref for idx, pref in enumerate(user_preferences) if pref
            }
        if not isinstance(user_preferences, dict):
            raise ValueError("user_preferences must be a dict of positions -> selection dict")

        for k, v in user_preferences.items():
            try:
                idx = int(k)
            except (TypeError, ValueError):
                raise ValueError(f"User preference key '{k}' is not an integer index")
            if not isinstance(v, dict):
                raise ValueError(f"user_preferences[{k}] must be a dict")

            entry: Dict[str, Any] = {}

            # JSON-native component refs only
            component_ref = v.get("component_ref")
            if component_ref is not None:
                if not isinstance(component_ref, dict) or not component_ref.get("type") or component_ref.get("id") is None:
                    raise ValueError(f"user_preferences[{k}].component_ref must be {{type, id}}")
                entry["component_ref"] = {"type": str(component_ref["type"]), "id": str(component_ref["id"])}

            if "component" in v and v["component"] is not None:
                component = v["component"]
                if isinstance(component, dict) and component.get("type") and component.get("id") is not None:
                    if "component_ref" in entry:
                        raise ValueError(f"user_preferences[{k}] cannot include both component and component_ref")
                    entry["component_ref"] = {"type": str(component["type"]), "id": str(component["id"])}
                else:
                    raise ValueError(f"user_preferences[{k}].component must be JSON {{type, id}} when provided")

            ctype = v.get("type")
            cid = v.get("id")
            if ctype and cid is not None:
                if "component_ref" in entry:
                    raise ValueError(f"user_preferences[{k}] cannot include both component_ref and type/id")
                entry["component_ref"] = {"type": str(ctype), "id": str(cid)}
            elif ctype:
                entry["component_type"] = str(ctype)
            elif "component_type" in v and v["component_type"]:
                if "component_ref" in entry:
                    raise ValueError(f"user_preferences[{k}] cannot include both component_ref and component_type")
                entry["component_type"] = str(v["component_type"])

            if "component_ref" in entry and "component_type" in entry:
                raise ValueError(f"user_preferences[{k}] cannot include both component_ref and component_type")

            # Optional capacity (forgiving parsing)
            if "capacity" in v:
                cap = v["capacity"]
                if cap is None:
                    pass
                elif isinstance(cap, str) and not cap.strip():
                    pass
                else:
                    try:
                        entry["capacity"] = float(cap)
                    except (TypeError, ValueError):
                        raise ValueError(f"user_preferences[{k}].capacity must be a number")

            # Pass-through optional selection hints
            for opt_key in ("manufacturer", "model", "configuration", "termination", "eye_type"):
                opt_val = v.get(opt_key)
                if opt_val not in (None, ""):
                    entry[opt_key] = opt_val

            # Validate manufacturer/model consistency for non-WireRope components
            # Rule: model requires manufacturer (either provided or auto-filled)
            if "model" in entry and entry.get("component_type") not in ["WireRope", None]:
                model_val = entry["model"]
                mfr_val = entry.get("manufacturer")
                ctype = entry.get("component_type")

                if ctype and model_val:
                    # Get the component model class (Shackle, Masterlink, etc.)
                    model_class = RiggingDesignService._get_component_model(ctype)
                    if model_class:
                        # Query for this model
                        qs = model_class.objects.filter(model=model_val)

                        if mfr_val:
                            # Manufacturer provided: verify model belongs to manufacturer
                            qs = qs.filter(manufacturer=mfr_val)
                            if not qs.exists():
                                raise ValueError(
                                    f"user_preferences[{k}]: model '{model_val}' not found for "
                                    f"component_type '{ctype}' and manufacturer '{mfr_val}'. "
                                    f"Please ensure the model belongs to the selected manufacturer."
                                )
                        else:
                            # No manufacturer: auto-fill if unambiguous
                            if not qs.exists():
                                raise ValueError(
                                    f"user_preferences[{k}]: model '{model_val}' not found for "
                                    f"component_type '{ctype}'"
                                )
                            if qs.count() == 1:
                                # Unambiguous: auto-fill manufacturer
                                entry["manufacturer"] = qs.first().manufacturer
                            else:
                                # Ambiguous: require explicit manufacturer
                                manufacturers = list(qs.values_list("manufacturer", flat=True).distinct())
                                raise ValueError(
                                    f"user_preferences[{k}]: model '{model_val}' exists with multiple manufacturers: "
                                    f"{manufacturers}. Please specify manufacturer explicitly."
                                )

            # Skip truly empty entries
            if not entry:
                continue

            parsed[idx] = entry

        return parsed

    @staticmethod
    def _strip_component_keys(obj: Any) -> Any:
        """Recursively remove 'component' keys, preserving 'component_id' and 'component_type' if present.
        This ensures DB JSON does not carry Django model instances or heavy component blobs.
        """
        if isinstance(obj, dict):
            new_obj: Dict[str, Any] = {}
            for k, v in obj.items():
                if k == "component":
                    # If walker converted instances to {type,id}, preserve as flat fields
                    if isinstance(v, dict):
                        comp_id = v.get("id")
                        comp_type = v.get("type")
                        if comp_id is not None:
                            new_obj["component_id"] = comp_id
                        if comp_type is not None:
                            new_obj["component_type"] = comp_type
                    # Skip the raw 'component' key regardless
                    continue
                new_obj[k] = RiggingDesignService._strip_component_keys(v)
            return new_obj
        if isinstance(obj, list):
            return [RiggingDesignService._strip_component_keys(x) for x in obj]
        return obj

    def validate_design_inputs(analysis_data: Dict[str, Any], user_preferences: Optional[Dict[str, Any]] = None) -> Tuple[bool, str]:
        """Validate using RiggingDesigner.validate_inputs."""
        try:
            analysis_input = RiggingDesignService._parse_analysis_input(analysis_data)
            ok, msg = RiggingDesigner.validate_inputs(analysis_input, user_preferences)
        except Exception as exc:
            rigging_logger.exception("validate_design_inputs: exception", extra={"error": str(exc)})
            return False, "Unexpected error while validating design inputs"
        return ok, msg

    # -----------------
    # Core operations
    # -----------------
    @staticmethod
    def run_design_for_analysis(
        analysis_id: str | Any,
        user_preferences: Optional[Dict[Any, Dict[str, Any]]] = None,
        name: str = "",
        set_active: bool = False,
        user=None,
    ) -> RiggingDesign:
        """Run design design for an existing LiftingAnalysis and persist results.

        Args:
            analysis_id: ID/UUID of LiftingAnalysis to base the design on.
            user_preferences: Optional user selections; may include type/id or component instances.
            name: Optional name for the design; version is auto-incremented per (analysis, name).
            set_active: If True, marks this design active and deactivates siblings.
            user: Optional user for permission check.
        """
        rigging_logger.info("run_design_for_analysis: input", extra={
            "analysis_id": str(analysis_id),
            "has_user_prefs": bool(user_preferences),
            "name": name,
            "set_active": set_active,
            "user": getattr(user, "id", None),
        })

        analysis = LiftingAnalysisService.get_analysis_by_id(analysis_id, user)
        if not analysis:
            raise ValueError("Analysis not found.")

        analysis_data = RiggingDesignService._analysis_to_input_payload(analysis)

        # Parse preferences into DTOs
        repository = RiggingDesignService._get_repository()
        parsed_prefs = RiggingDesignService._parse_user_preferences_dto(user_preferences)
        input_data = RiggingDesignInput(
            analysis_data=analysis_data,
            user_preferences=parsed_prefs,
        )

        # Run the domain entrypoint
        try:
            design_payload = design_rigging(input_data, repository)
        except DomainValidationError:
            raise
        except Exception as exc:
            rigging_logger.exception("run_design_for_analysis: design_failed", extra={"analysis_id": str(analysis_id)})
            raise ValueError("Rigging design computation failed") from exc

        arrangement = design_payload.get("arrangement")
        results_payload = RiggingDesignService._strip_component_keys(design_payload)

        # Persist
        try:
            with transaction.atomic():
                version = RiggingDesignService._next_version(analysis, name)
                if set_active:
                    # Deactivate siblings for this analysis
                    RiggingDesign.objects.filter(analysis=analysis, is_active=True).update(is_active=False)
                design = RiggingDesign.objects.create(
                    analysis=analysis,
                    project=analysis.project,  # will be enforced by model save as well
                    name=name or "",
                    status="final" if set_active else "draft",
                    version=version,
                    is_active=bool(set_active),
                    arrangement=arrangement or {},
                    results=results_payload or {},
                )
        except IntegrityError:
            # In case of a race on unique_together, retry with next version
            with transaction.atomic():
                version = RiggingDesignService._next_version(analysis, name)
                design = RiggingDesign.objects.create(
                    analysis=analysis,
                    project=analysis.project,
                    name=name or "",
                    status="final" if set_active else "draft",
                    version=version,
                    is_active=bool(set_active),
                    arrangement=arrangement or {},
                    results=results_payload or {},
                )
        except Exception:
            rigging_logger.exception("run_design_for_analysis: db_create_failed", extra={
                "analysis_id": str(analysis_id),
                "name": name,
            })
            raise

        rigging_logger.info("run_design_for_analysis: created", extra={
            "design_id": str(getattr(design, "id", None)),
            "analysis_id": str(getattr(analysis, "id", None)),
            "version": getattr(design, "version", None),
            "active": getattr(design, "is_active", None),
        })
        return design

    @staticmethod
    def _next_version(analysis: LiftingAnalysis, name: str) -> int:
        qs = RiggingDesign.objects.filter(analysis=analysis, name=name or "")
        latest = qs.order_by("-version").first()
        return (getattr(latest, "version", 0) or 0) + 1

    @staticmethod
    def recompute_design(
        design: RiggingDesign,
        user_preferences: Optional[Dict[Any, Dict[str, Any]]] = None,
        name: Optional[str] = None,
        status: Optional[str] = None,
    ) -> RiggingDesign:
        """Re-run the rigging design engine for an existing design row, in place.

        Overwrites ``arrangement`` and ``results`` on the same row. Leaves
        ``id``, ``version``, ``analysis``/``project`` FKs and ``is_active``
        untouched so that downstream relationships (e.g. report links) stay
        valid. Used by PATCH endpoints to support in-place editing of saved
        designs without ever creating a sibling record.

        Args:
            design: The existing RiggingDesign instance to recompute.
            user_preferences: Optional updated preferences to feed into the engine.
            name: Optional new name (metadata only, no recompute side-effect).
            status: Optional new status (metadata only, no recompute side-effect).

        Returns:
            The updated RiggingDesign instance (same primary key).
        """
        rigging_logger.info("recompute_design: input", extra={
            "design_id": str(getattr(design, "id", None)),
            "analysis_id": str(getattr(design.analysis, "id", None)) if design.analysis else None,
            "has_user_prefs": bool(user_preferences),
        })

        analysis = design.analysis
        if not analysis:
            raise ValueError("Design has no associated analysis to recompute against.")

        analysis_data = RiggingDesignService._analysis_to_input_payload(analysis)
        repository = RiggingDesignService._get_repository()
        parsed_prefs = RiggingDesignService._parse_user_preferences_dto(user_preferences)
        input_data = RiggingDesignInput(
            analysis_data=analysis_data,
            user_preferences=parsed_prefs,
        )

        try:
            design_payload = design_rigging(input_data, repository)
        except DomainValidationError:
            raise
        except Exception as exc:
            rigging_logger.exception(
                "recompute_design: design_failed",
                extra={"design_id": str(getattr(design, "id", None))},
            )
            raise ValueError("Rigging design recomputation failed") from exc

        arrangement = design_payload.get("arrangement")
        results_payload = RiggingDesignService._strip_component_keys(design_payload)

        try:
            with transaction.atomic():
                design.arrangement = arrangement or {}
                design.results = results_payload or {}
                if name is not None:
                    design.name = name
                if status is not None:
                    design.status = status
                design.save()
        except Exception:
            rigging_logger.exception(
                "recompute_design: db_update_failed",
                extra={"design_id": str(getattr(design, "id", None))},
            )
            raise

        rigging_logger.info("recompute_design: updated", extra={
            "design_id": str(getattr(design, "id", None)),
            "analysis_id": str(getattr(analysis, "id", None)),
            "version": getattr(design, "version", None),
        })
        return design


    # -----------------
    # Retrieval/listing
    # -----------------
    @staticmethod
    def get_design(design_id: str | Any, user=None) -> Optional[RiggingDesign]:
        rigging_logger.info("get_design: input", extra={
            "design_id": str(design_id),
            "user": getattr(user, "id", None),
        })
        try:
            design = RiggingDesign.objects.select_related("analysis", "project").get(id=design_id)
        except RiggingDesign.DoesNotExist:
            rigging_logger.warning("get_design: not_found", extra={"design_id": str(design_id)})
            return None
        if user and getattr(getattr(design, "project", None), "owner", None) != user:
            rigging_logger.error("get_design: permission_denied", extra={
                "design_id": str(design_id),
                "user_id": getattr(user, "id", None),
            })
            raise ValueError("User does not have permission to access this design.")
        rigging_logger.info("get_design: found", extra={
            "design_id": str(getattr(design, "id", None)),
            "analysis_id": str(getattr(getattr(design, "analysis", None), "id", None)),
        })
        return design

    @staticmethod
    def list_designs(
        analysis_id: str | Any,
        user=None,
        page: int = 1,
        page_size: int = 20,
        ordering: Optional[str] = "-created_at",
    ) -> Dict[str, Any]:
        analysis = LiftingAnalysisService.get_analysis_by_id(analysis_id, user)
        if not analysis:
            raise ValueError("Analysis not found.")

        qs = RiggingDesign.objects.filter(analysis=analysis)
        if ordering:
            qs = qs.order_by(ordering)

        total = qs.count()
        try:
            page = int(page)
            page_size = max(1, int(page_size))
        except (TypeError, ValueError):
            page = 1
            page_size = 20
        start = (page - 1) * page_size
        end = start + page_size
        page_qs = qs[start:end]

        items = [
            {
                "id": str(obj.id),
                "name": getattr(obj, "name", ""),
                "version": obj.version,
                "status": obj.status,
                "is_active": obj.is_active,
                "created_at": obj.created_at.isoformat(),
            }
            for obj in page_qs
        ]

        rigging_logger.info("list_designs: listed", extra={
            "analysis_id": str(analysis_id),
            "count": len(items),
            "page": page,
            "page_size": page_size,
            "total": total,
        })
        return {"items": items, "page": page, "page_size": page_size, "total": total}

    @staticmethod
    def activate_design(design_id: str | Any, user=None) -> RiggingDesign:
        design = RiggingDesignService.get_design(design_id, user)
        if not design:
            raise ValueError("Design not found.")
        try:
            with transaction.atomic():
                if design.analysis_id:
                    RiggingDesign.objects.filter(analysis=design.analysis, is_active=True).exclude(id=design.id).update(is_active=False)
                else:
                    RiggingDesign.objects.filter(analysis__isnull=True, project=design.project, is_active=True).exclude(id=design.id).update(is_active=False)
                design.is_active = True
                design.status = "final"
                design.save()
        except Exception:
            rigging_logger.exception("activate_design: failed", extra={"design_id": str(design_id)})
            raise
        rigging_logger.info("activate_design: activated", extra={"design_id": str(design_id)})
        return design

    # -----------------
    # Export helpers
    # -----------------
    @staticmethod
    def export_design(design_id: str | Any, format: str = "json", user=None) -> Any:
        rigging_logger.info("export_design: input", extra={
            "design_id": str(design_id),
            "format": format,
            "user": getattr(user, "id", None),
        })
        design = RiggingDesignService.get_design(design_id, user)
        if not design:
            raise ValueError("Design not found.")

        payload = {
            "id": str(design.id),
            # "analysis_id": str(getattr(design.analysis, "id", None)),
            "analysis_id": (str(design.analysis.id) if design.analysis_id else None),
            "name": design.name,
            "version": design.version,
            "status": design.status,
            "is_active": design.is_active,
            "created_at": design.created_at.isoformat(),
            "arrangement": design.arrangement,
            "results": design.results,
        }
        if format.lower() == "json":
            return payload
        elif format.lower() == "csv":
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow(["Property", "Value"])
            for k in ["id", "analysis_id", "name", "version", "status", "is_active", "created_at"]:
                writer.writerow([k, payload[k]])
            writer.writerow([])
            writer.writerow(["Arrangement", ""])  # flatten minimally
            for key, value in (payload.get("arrangement") or {}).items():
                writer.writerow([key, value])
            writer.writerow([])
            writer.writerow(["Results", "… see JSON for full details …"])  # avoid massive CSV
            out = buf.getvalue()
            buf.close()
            return out
        else:
            raise ValueError(f"Unsupported export format: {format}")

    @staticmethod
    def delete_design(design_id: str | Any, user=None) -> None:
        design = RiggingDesignService.get_design(design_id, user)
        if not design:
            raise ValueError("Design not found.")
        try:
            with transaction.atomic():
                design.delete()
        except Exception:
            rigging_logger.exception("delete_design: failed", extra={"design_id": str(design_id)})
            raise
        rigging_logger.info("delete_design: deleted", extra={"design_id": str(design_id)})
