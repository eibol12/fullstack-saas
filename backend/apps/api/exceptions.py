from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import (
APIException,
AuthenticationFailed,
NotAuthenticated,
PermissionDenied,
ValidationError,
NotFound
)
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from domain.utils.exceptions import (
    DomainValidationError,
    InvalidArrangementLengthError,
    InvalidComponentTypeError,
    InvalidFirstComponentError,
    InvalidLastComponentError,
    MissingRequiredComponentError,
    WireRopeLastComponentError,
)

def _get_request_id(request) -> str | None:
    if request is None:
        return None
    return request.headers.get("X-Request-ID") or request.META.get("HTTP_X_REQUEST_ID")

def _error_response(
        *,
        http_status: int,
        code: str,
        message:str,
        details = None,
        request_id: str | None = None,
):
    payload = {"error": {"code":code, "message":message}}
    if details not in (None, "", [], {}):
        payload["error"]["details"] = details
    if request_id is not None:
        payload["error"]["request_id"] = request_id
    return Response(payload, status=http_status)


def _get_domain_error_code(exc: DomainValidationError) -> str:
    explicit_code = getattr(exc, "code", None)
    if explicit_code:
        return explicit_code

    if isinstance(exc, InvalidArrangementLengthError):
        return "invalid_arrangement_length"
    if isinstance(exc, InvalidFirstComponentError):
        return "invalid_first_component"
    if isinstance(exc, InvalidLastComponentError):
        return "invalid_last_component"
    if isinstance(exc, MissingRequiredComponentError):
        return "missing_required_component"
    if isinstance(exc, WireRopeLastComponentError):
        return "wire_rope_last_component"
    if isinstance(exc, InvalidComponentTypeError):
        return "invalid_component_type"

    return "domain_validation_error"

def custom_exception_handler(exc, context):
    """
    Unifies all API errors into:
      {"error": {"code": "...", "message": "...", "details": ...}}

    It delegates to DRF first, and only formats/wraps the response.
    """
    request = context.get("request") if isinstance(context, dict) else None
    request_id = _get_request_id(request)

    #1) Domain-level validation errors
    if isinstance(exc, DomainValidationError):
        return _error_response(
            http_status=status.HTTP_400_BAD_REQUEST,
            code = _get_domain_error_code(exc),
            message = str(exc) or "Domain validation error occurred",
            details=exc.errors or None,
            request_id=request_id,
        )

    #2) Let DRF build a response for known DRF exceptions.
    response = drf_exception_handler(exc, context)
    if response is not None:
        #DRF commonly puts details into response.data
        details = response.data

        if isinstance(exc, ValidationError):
            code = "validation_error"
            message = "Invalid input."
        elif isinstance(exc, NotAuthenticated):
            code = "authentication_error"
            message = "Authentication credentials were not provided."
        elif isinstance(exc, AuthenticationFailed):
            code = "authentication_error"
            message = "Invalid authentication credentials."
        elif isinstance(exc, PermissionDenied):
            code = "permission_denied"
            message = "You do not have permission to perform this action."
        elif isinstance(exc, NotFound):
            code = "not_found"
            message = "The requested resource was not found."
        elif isinstance(exc, APIException):
            code = getattr(exc, "default_code", None) or "api_error"
            message = str(getattr(exc, "detail", None)) or "Request failed."
        else:
            code = "error"
            message = "Request failed.."

        return _error_response(
            http_status=response.status_code,
            code=code,
            message=message,
            details=details,
            request_id=request_id,
        )

    #3) Unknown exception, return 500
    return _error_response(
        http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="internal_error",
        message="An unexpected error occurred.",
        details=None,
        request_id=request_id,
    )
