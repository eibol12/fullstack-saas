from typing import Dict, Any, Optional, Tuple
import logging

from django.db import transaction
from django.db.models import QuerySet
import csv
import io

from domain.standards.dnv import DNVLiftingOperations
from domain.lifting.validation import validate_lifting_inputs
from apps.main.models import (
    LiftingAnalysis, Project
)
from apps.main.constants import VALID_LOCATIONS, ALLOWED_LIFTING_POINTS

logger = logging.getLogger("lifting.analysis")

class LiftingAnalysisService:
    @staticmethod
    def analyze_lifting(maximum_gross_weight: float, location: str, configuration: Dict[str, Any]) -> Dict[str, Any]:
        """Perform a lifting analysis without design design.

        Parameters:
            maximum_gross_weight: The maximum gross weight of the object (tonnes or kg as per domain).
            location: The location of the lifting operation.
            configuration: The configuration parameters for the lifting operation.

        Returns:
            A dictionary containing the analysis results.

        Raises:
            ValueError: If validation fails or the analysis cannot be performed.
        """
        # Validate first
        ok, msg = LiftingAnalysisService.validate_lifting_inputs(maximum_gross_weight, location, configuration)
        if not ok:
            logger.warning("analyze_lifting: validation_failed", extra={
                "maximum_gross_weight": maximum_gross_weight,
                "location": location,
                "config_keys": list(configuration.keys()) if isinstance(configuration, dict) else str(type(configuration)),
                "error": msg,
            })
            raise ValueError(msg)

        # Log inputs
        logger.info("analyze_lifting: inputs", extra={
            "maximum_gross_weight": maximum_gross_weight,
            "location": location,
            "config_keys": list(configuration.keys()) if isinstance(configuration, dict) else str(type(configuration)),
        })

        try:
            lifting_analysis = DNVLiftingOperations(
                maximum_gross_weight=maximum_gross_weight,
                location=location,
                configuration=configuration,
            )
            lifting_analysis.analyze()
            analysis_results = lifting_analysis.to_dict()
        except Exception as exc:
            logger.exception("analyze_lifting: analysis_failed", extra={
                "maximum_gross_weight": maximum_gross_weight,
                "location": location,
            })
            raise ValueError("Failed to perform lifting analysis. Please check inputs.") from exc

        logger.info("analyze_lifting: outputs", extra={
            "results_keys": list(analysis_results.keys()) if isinstance(analysis_results, dict) else str(type(analysis_results)),
        })
        return analysis_results

    @staticmethod
    def validate_lifting_inputs(maximum_gross_weight: float, location: str, configuration: Dict[str, Any]) -> Tuple[bool, str]:
        """Validate inputs for lifting analysis.

        Parameters:
            maximum_gross_weight: The maximum gross weight of the object.
            location: Operational location (must be in VALID_LOCATIONS).
            configuration: Dict of configuration parameters.

        Returns:
            (is_valid, error_message)
        """
        return validate_lifting_inputs(
            maximum_gross_weight=maximum_gross_weight,
            location=location,
            configuration=configuration,
            allowed_locations=VALID_LOCATIONS,
            allowed_lifting_points=ALLOWED_LIFTING_POINTS,
        )

    @staticmethod
    def save_analysis_results(analysis_data: Dict[str, Any], project: Project = None, user=None) -> LiftingAnalysis:
        """Save analysis result to the database, enforcing a user and project.

        Parameters:
            analysis_data: The analysis data payload.
            project: Project to associate the analysis with.
            user: The owner performing the save.

        Returns:
            The saved LiftingAnalysis instance.

        Raises:
            ValueError: If user/project missing, ownership fails, schema invalid, or inputs invalid.
        """
        if not user or not project:
            raise ValueError("User and project must be provided to save analysis.")

        # Ensure project belongs to user
        if getattr(project, 'owner', None) != user:
            logger.error("save_analysis_results: ownership_failed", extra={
                "project_id": getattr(project, 'id', None),
                "user_id": getattr(user, 'id', None),
            })
            raise ValueError("Project does not belong to the specified user.")

        # Schema validation
        required = {"analysis_name", "maximum_gross_weight", "location", "configuration", "lifting_points_qty", "results"}
        missing = required - set(analysis_data.keys())
        if missing:
            logger.warning("save_analysis_results: schema_missing", extra={"missing": sorted(list(missing))})
            raise ValueError(f"Missing required fields: {', '.join(sorted(missing))}.")

        # Input validation using the same rules
        ok, msg = LiftingAnalysisService.validate_lifting_inputs(
            analysis_data["maximum_gross_weight"],
            analysis_data["location"],
            analysis_data["configuration"],
        )
        if not ok:
            logger.warning("save_analysis_results: validation_failed", extra={"error": msg})
            raise ValueError(msg)

        # Log inputs before saving
        logger.info("save_analysis_results: inputs", extra={
            "user": getattr(user, "id", None),
            "project": getattr(project, "id", None),
            "analysis_name": analysis_data.get("analysis_name"),
            "lifting_points_qty": analysis_data.get("lifting_points_qty"),
        })

        try:
            with transaction.atomic():
                analysis = LiftingAnalysis.objects.create(
                    name=analysis_data["analysis_name"],
                    project=project,
                    maximum_gross_weight=analysis_data["maximum_gross_weight"],
                    location=analysis_data["location"],
                    configuration=analysis_data["configuration"],
                    lifting_points_qty=analysis_data["lifting_points_qty"],
                    results=analysis_data["results"],
                )
        except Exception as exc:
            logger.exception("save_analysis_results: db_create_failed", extra={
                "project_id": getattr(project, 'id', None),
                "user_id": getattr(user, 'id', None),
                "analysis_name": analysis_data.get("analysis_name"),
            })
            raise

        logger.info("save_analysis_results: created", extra={
            "analysis_id": str(getattr(analysis, "id", None))
        })
        return analysis

    @staticmethod
    def get_user_analyses(user, project: Optional[Project] = None) -> QuerySet[LiftingAnalysis]:
        """Get all analyses for a user, optionally filtered by project.

        Parameters:
            user: The user to get analyses for.
            project: Optional project to filter by.

        Returns:
            A queryset of analyses for the user (filtered by project if provided).
        """
        if project:
            # Ensure project belongs to user
            if project.owner != user:
                raise ValueError("Project does not belong to the specified user.")
            return LiftingAnalysis.objects.filter(project=project)
        else:
            # Get all analyses for projects owned by the user
            return LiftingAnalysis.objects.filter(project__owner=user)

    @staticmethod
    def prepare_analysis_data(analysis_name: str, maximum_gross_weight: float, location: str, configuration: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare analysis data for saving.

        Parameters:
            analysis_name: The desired name for the analysis record.
            maximum_gross_weight: The maximum gross weight of the object.
            location: Operational location.
            configuration: Configuration parameters.

        Returns:
            A dict payload ready to be persisted by save_analysis_results.

        Raises:
            ValueError: If inputs are invalid.
        """
        ok, msg = LiftingAnalysisService.validate_lifting_inputs(maximum_gross_weight, location, configuration)
        if not ok:
            logger.warning("prepare_analysis_data: validation_failed", extra={"error": msg})
            raise ValueError(msg)

        # Perform the analysis
        results = LiftingAnalysisService.analyze_lifting(
            maximum_gross_weight=maximum_gross_weight,
            location=location,
            configuration=configuration,
        )

        # Prepare the data for saving
        analysis_data: Dict[str, Any] = {
            "analysis_name": analysis_name,
            "maximum_gross_weight": maximum_gross_weight,
            "location": location,
            "configuration": configuration,
            "lifting_points_qty": int(configuration.get("lifting_points_qty", 0)),
            "results": results,
        }

        # Log the prepared payload
        logger.info("prepare_analysis_data: payload", extra={
            "analysis_name": analysis_name,
            "maximum_gross_weight": maximum_gross_weight,
            "location": location,
            "lifting_points_qty": analysis_data["lifting_points_qty"],
            "config_keys": list(configuration.keys()) if isinstance(configuration, dict) else str(type(configuration)),
            "results_keys": list(results.keys()) if isinstance(results, dict) else str(type(results)),
        })

        return analysis_data

    @staticmethod
    def get_analysis_by_id(analysis_id: int | str, user=None) -> Optional[LiftingAnalysis]:
        """Get a lifting analysis by ID.

        Parameters:
            analysis_id: The ID of the analysis to retrieve.
            user: Optional user to validate ownership.

        Returns:
            The requested LiftingAnalysis or None if not found.

        Raises:
            ValueError: If user is provided and doesn't own the analysis.
        """
        logger.info("get_analysis_by_id: input", extra={
            "analysis_id": str(analysis_id),
            "user": getattr(user, "id", None),
        })
        try:
            analysis = LiftingAnalysis.objects.get(id=analysis_id)
            if user and analysis.project.owner != user:
                logger.error("get_analysis_by_id: permission_denied", extra={
                    "analysis_id": str(analysis_id),
                    "user_id": getattr(user, 'id', None),
                    "project_user_id": getattr(getattr(analysis, 'project', None), 'user_id', None),
                })
                raise ValueError("User does not have permission to access this analysis.")
            logger.info("get_analysis_by_id: found", extra={
                "analysis_id": str(getattr(analysis, "id", None)),
                "project_id": str(getattr(analysis.project, "id", None)) if getattr(analysis, "project", None) else None,
            })
            return analysis
        except LiftingAnalysis.DoesNotExist:
            logger.warning("get_analysis_by_id: not_found", extra={
                "analysis_id": str(analysis_id)
            })
            return None

    @staticmethod
    def update_analysis(analysis_id: int | str, updates: Dict[str, Any], user=None) -> LiftingAnalysis:
        """Update an existing analysis. Re-runs analysis when key inputs change.

        Parameters:
            analysis_id: ID of the analysis to update.
            updates: Dict of fields to update. Supported keys: 'analysis_name', 'maximum_gross_weight', 'location', 'configuration'.
            user: Optional user to enforce ownership.

        Returns:
            The updated LiftingAnalysis instance.
        """
        analysis = LiftingAnalysisService.get_analysis_by_id(analysis_id, user)
        if not analysis:
            raise ValueError("Analysis not found.")

        # Determine new values
        new_name = updates.get("analysis_name", getattr(analysis, "name", None))
        new_weight = updates.get("maximum_gross_weight", analysis.maximum_gross_weight)
        new_location = updates.get("location", analysis.location)
        new_config = updates.get("configuration", analysis.configuration)

        # Validate inputs if any of the core fields change or always validate to be safe
        ok, msg = LiftingAnalysisService.validate_lifting_inputs(new_weight, new_location, new_config)
        if not ok:
            logger.warning("update_analysis: validation_failed", extra={"analysis_id": str(analysis_id), "error": msg})
            raise ValueError(msg)

        needs_reanalysis = any(k in updates for k in ("maximum_gross_weight", "location", "configuration"))

        try:
            with transaction.atomic():
                # Re-run analysis if required
                if needs_reanalysis:
                    try:
                        results = LiftingAnalysisService.analyze_lifting(new_weight, new_location, new_config)
                    except ValueError as exc:
                        logger.exception("update_analysis: analyze_failed", extra={"analysis_id": str(analysis_id)})
                        raise
                    analysis.results = results
                    analysis.lifting_points_qty = int(new_config.get("lifting_points_qty", analysis.lifting_points_qty))

                # Apply simple field updates
                if new_name is not None:
                    analysis.name = new_name
                analysis.maximum_gross_weight = new_weight
                analysis.location = new_location
                analysis.configuration = new_config

                analysis.save()
        except Exception:
            logger.exception("update_analysis: db_update_failed", extra={"analysis_id": str(analysis_id)})
            raise

        logger.info("update_analysis: updated", extra={"analysis_id": str(getattr(analysis, "id", None))})
        return analysis

    @staticmethod
    def delete_analysis(analysis_id: int | str, user=None) -> None:
        """Delete an analysis after permission check."""
        analysis = LiftingAnalysisService.get_analysis_by_id(analysis_id, user)
        if not analysis:
            raise ValueError("Analysis not found.")
        try:
            with transaction.atomic():
                analysis.delete()
        except Exception:
            logger.exception("delete_analysis: failed", extra={"analysis_id": str(analysis_id)})
            raise
        logger.info("delete_analysis: deleted", extra={"analysis_id": str(analysis_id)})

    @staticmethod
    def list_analyses(
        user,
        project: Optional[Project] = None,
        page: int = 1,
        page_size: int = 20,
        filters: Optional[Dict[str, Any]] = None,
        ordering: Optional[str] = "-created_at",
    ) -> Dict[str, Any]:
        """List analyses with optional filters and pagination.

        Parameters:
            user: Owner user to scope the listing.
            project: Optional project to filter by.
            page: 1-based page index.
            page_size: Items per page.
            filters: Optional filters dict. Keys: name (icontains), location, date_from (iso), date_to (iso).
            ordering: Django ordering string, default '-created_at'.
        Returns:
            Dict with keys: items (list of dict), page, page_size, total.
        """
        qs = LiftingAnalysisService.get_user_analyses(user, project)

        # Apply filters
        filters = filters or {}
        name = filters.get("name")
        if name:
            qs = qs.filter(name__icontains=name)
        location = filters.get("location")
        if location:
            qs = qs.filter(location=location)
        date_from = filters.get("date_from")
        if date_from:
            qs = qs.filter(created_at__gte=date_from)
        date_to = filters.get("date_to")
        if date_to:
            qs = qs.filter(created_at__lte=date_to)

        # Ordering
        if ordering:
            qs = qs.order_by(ordering)

        total = qs.count()
        # Pagination
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
                "project_id": str(getattr(getattr(obj, "project", None), "id", "")),
                "location": obj.location,
                "maximum_gross_weight": obj.maximum_gross_weight,
                "lifting_points_qty": obj.lifting_points_qty,
                "created_at": obj.created_at.isoformat(),
            }
            for obj in page_qs
        ]

        logger.info("list_analyses: listed", extra={
            "user_id": getattr(user, 'id', None),
            "project_id": getattr(project, 'id', None) if project else None,
            "page": page,
            "page_size": page_size,
            "total": total,
        })

        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total,
        }

