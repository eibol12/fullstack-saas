class DomainValidationError(Exception):
    """Base class for domain validation errors with optional structured details."""

    def __init__(self, message="Domain validation error", *, code=None, errors=None):
        self.message = message
        self.code = code
        self.errors = list(errors) if errors else []
        super().__init__(self.message)

    def __str__(self):
        return self.message


class InvalidRiggingArrangementException(DomainValidationError):
    """
    Exception raised when a design arrangement is invalid.
    
    This exception is raised when a user-proposed design arrangement
    violates one or more of the required rules:
    1. List must contain 3-10 components
    2. First component must be a Masterlink/MasterlinkAssembly (appropriate for lifting points qty)
    3. Last component must be a Shackle
    4. Must have at least one of each: Masterlink/MasterlinkAssembly, WireRope, and Shackle
    5. WireRope cannot be the last component
    6. All component types must be valid
    
    Attributes:
        message: The error message
        default_arrangement: The default arrangement that would be used instead (added by the caller)
    """
    
    def __init__(self, message="Invalid design arrangement", *, code=None, errors=None):
        self.default_arrangement = None
        super().__init__(message, code=code, errors=errors)


class InvalidArrangementLengthError(InvalidRiggingArrangementException):
    def __init__(self, message="Invalid arrangement length"):
        super().__init__(message, code="invalid_arrangement_length")


class InvalidFirstComponentError(InvalidRiggingArrangementException):
    def __init__(self, message="Invalid first component"):
        super().__init__(message, code="invalid_first_component")


class InvalidLastComponentError(InvalidRiggingArrangementException):
    def __init__(self, message="Invalid last component"):
        super().__init__(message, code="invalid_last_component")


class MissingRequiredComponentError(InvalidRiggingArrangementException):
    def __init__(self, message="Missing required component"):
        super().__init__(message, code="missing_required_component")


class WireRopeLastComponentError(InvalidRiggingArrangementException):
    def __init__(self, message="WireRope cannot be the last component"):
        super().__init__(message, code="wire_rope_last_component")


class InvalidComponentTypeError(InvalidRiggingArrangementException):
    def __init__(self, message="Invalid component type"):
        super().__init__(message, code="invalid_component_type")
