from domain.rigging.ports import ComponentRef
from domain.utils.exceptions import DomainValidationError


class RiggingDesignError(DomainValidationError):
    """Base class for design design domain errors."""


class RiggingDesignInputError(DomainValidationError):
    """Raised when design design input is malformed."""


class InvalidUserPreferenceError(DomainValidationError):
    """Raised when the user preferences DTO is malformed or inconsistent."""


class ComponentNotFoundError(DomainValidationError):
    def __init__(self, ref: ComponentRef) -> None:
        super().__init__(f"Component not found: {ref.type} {ref.id}", code="component_not_found")
        self.ref = ref
