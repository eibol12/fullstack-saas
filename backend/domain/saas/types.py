from dataclasses import dataclass
from typing import Optional
from enum import Enum


class Tier(str, Enum):
    """Pure domain enum for SaaS Tiers."""
    FREE = 'free'
    STARTER = 'starter'
    PRO = 'pro'


@dataclass(frozen=True)
class UserTierContext:
    """
    Pure domain representation of a user's subscription state and usage.
    Used to decouple TierPolicy from Django models.
    """
    tier: str
    subscription_active: bool
    project_count: int
    max_analyses_in_any_project: int
    max_designs_in_any_analysis: int
    user_id: Optional[int] = None

