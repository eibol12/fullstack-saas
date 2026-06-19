"""
Custom exceptions for billing and tier-based access control.
"""


class TierLimitExceeded(Exception):
    """
    Raised when a user attempts to exceed their tier's resource limits.

    This exception should include information about:
    - The resource type (projects, analyses, designs)
    - Current usage count
    - Maximum allowed by tier
    - Upgrade suggestion
    """
    def __init__(self, message, resource_type=None, current=None, limit=None, tier=None):
        self.resource_type = resource_type
        self.current = current
        self.limit = limit
        self.tier = tier
        super().__init__(message)


class InsufficientTierException(Exception):
    """
    Raised when a user attempts to access a feature not available in their tier.

    Examples:
    - Free tier trying to export PDF
    - Starter tier trying to use API
    """
    def __init__(self, message, feature=None, required_tier=None, current_tier=None):
        self.feature = feature
        self.required_tier = required_tier
        self.current_tier = current_tier
        super().__init__(message)


class SubscriptionRequiredException(Exception):
    """
    Raised when a feature requires an active paid subscription.
    """
    pass
