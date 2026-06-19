import logging
from typing import Any, Dict
import sentry_sdk

from domain.rigging.design import RiggingDesigner
from domain.rigging.errors import RiggingDesignError, RiggingDesignInputError
from domain.rigging.ports import RiggingRepository
from domain.rigging.types import RiggingDesignInput
from domain.utils.exceptions import DomainValidationError
from domain.utils.serialization import json_safe

logger = logging.getLogger(__name__)


def design(input_data: RiggingDesignInput, repository: RiggingRepository) -> Dict[str, Any]:
    """Canonical entrypoint for design design."""
    if not isinstance(input_data, RiggingDesignInput):
        raise RiggingDesignInputError("input must be a RiggingDesignInput")

    analysis_data = input_data.analysis_data
    user_preferences = input_data.user_preferences

    logger.info(
        "Rigging design computation started",
        extra={
            "lifting_points_qty": getattr(analysis_data, "lifting_points_qty", None),
            "static_hook_load": getattr(getattr(analysis_data, "results", None), "static_hook_load", None),
            "dynamic_hook_load": getattr(getattr(analysis_data, "results", None), "dynamic_hook_load", None),
            "user_preferences_count": len(user_preferences) if user_preferences else 0,
        }
    )

    ok, msg = RiggingDesigner.validate_inputs(analysis_data, user_preferences)
    if not ok:
        logger.warning(
            "Rigging design inputs validation failed: %s", msg,
            extra={
                "lifting_points_qty": getattr(analysis_data, "lifting_points_qty", None),
            }
        )
        raise RiggingDesignInputError(msg)

    try:
        designer = RiggingDesigner(
            analysis_data=analysis_data,
            user_preferences=user_preferences,
            repository=repository,
        )
        try:
            res = designer.JSON_serializible_to_dict()
        except AttributeError:
            res = json_safe(designer.to_dict())

        logger.info(
            "Rigging design computation completed successfully",
            extra={
                "lifting_points_qty": getattr(analysis_data, "lifting_points_qty", None),
                "output_keys": list(res.keys()) if res else [],
            }
        )
        return res
    except DomainValidationError:
        # Standard validation exceptions: do not spam logging or sentry
        raise
    except Exception as exc:
        # Detect standard validation errors from other packages dynamically
        exc_class_name = exc.__class__.__name__
        if "ValidationError" in exc_class_name:
            raise

        logger.exception("Rigging design computation failed due to an unexpected error")
        sentry_sdk.capture_exception(exc)
        raise RiggingDesignError("Rigging design computation failed") from exc
