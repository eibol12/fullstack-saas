"""
Tier Policy - Pure Domain logic for SaaS tier-based access control.

This module contains the core business logic for checking and enforcing
tier limits and permissions. It is strictly framework-agnostic.
"""
from typing import Tuple, Optional, Dict, Any
import logging
from .constants import TIER_LIMITS
from .types import Tier, UserTierContext

logger = logging.getLogger(__name__)



class TierPolicy:
    """
    Validates and enforces tier-based limits and permissions.

    This class provides pure functional methods to check if an action
    is permitted based on the provided context.
    """

    @staticmethod
    def _get_tier_limits(tier: str) -> Dict[str, Any]:
        """
        Get limits configuration for a specific tier.
        """
        return TIER_LIMITS.get(tier, TIER_LIMITS[Tier.FREE])

    @staticmethod
    def can_create_project(context: UserTierContext) -> Tuple[bool, int, Optional[int], str]:
        """
        Check if user can create another project.
        """
        limits = TierPolicy._get_tier_limits(context.tier)
        max_projects = limits['max_projects']
        current_count = context.project_count

        if max_projects is None:
            logger.info(
                "SaaS limit check passed for project creation",
                extra={
                    "user_id": context.user_id,
                    "tier": context.tier,
                    "resource_type": "project",
                    "current_count": current_count,
                    "limit": None,
                }
            )
            return True, current_count, None, "Unlimited projects allowed"

        if current_count < max_projects:
            remaining = max_projects - current_count
            logger.info(
                "SaaS limit check passed for project creation",
                extra={
                    "user_id": context.user_id,
                    "tier": context.tier,
                    "resource_type": "project",
                    "current_count": current_count,
                    "limit": max_projects,
                }
            )
            return True, current_count, max_projects, f"{remaining} project(s) remaining"

        tier_name = context.tier.replace('_', ' ').title()
        message = f"{tier_name} tier allows {max_projects} project(s). You have {current_count}."

        if context.tier == Tier.FREE:
            message += " Upgrade to Starter for 3 projects or Pro for unlimited."
        elif context.tier == Tier.STARTER:
            message += " Upgrade to Pro for unlimited projects."

        logger.warning(
            "SaaS limit check failed for project creation",
            extra={
                "user_id": context.user_id,
                "tier": context.tier,
                "resource_type": "project",
                "current_count": current_count,
                "limit": max_projects,
            }
        )
        return False, current_count, max_projects, message

    @staticmethod
    def can_create_analysis(context: UserTierContext, current_project_analysis_count: int) -> Tuple[bool, int, Optional[int], str]:
        """
        Check if user can create another analysis in a project.
        """
        limits = TierPolicy._get_tier_limits(context.tier)
        max_analyses = limits['max_analyses_per_project']

        if max_analyses is None:
            logger.info(
                "SaaS limit check passed for analysis creation",
                extra={
                    "user_id": context.user_id,
                    "tier": context.tier,
                    "resource_type": "analysis",
                    "current_count": current_project_analysis_count,
                    "limit": None,
                }
            )
            return True, current_project_analysis_count, None, "Unlimited analyses allowed"

        if current_project_analysis_count < max_analyses:
            remaining = max_analyses - current_project_analysis_count
            logger.info(
                "SaaS limit check passed for analysis creation",
                extra={
                    "user_id": context.user_id,
                    "tier": context.tier,
                    "resource_type": "analysis",
                    "current_count": current_project_analysis_count,
                    "limit": max_analyses,
                }
            )
            return True, current_project_analysis_count, max_analyses, f"{remaining} analysis(es) remaining for this project"

        tier_name = context.tier.replace('_', ' ').title()
        message = f"{tier_name} tier allows {max_analyses} analysis(es) per project. This project has {current_project_analysis_count}."

        if context.tier == Tier.FREE:
            message += " Upgrade to Starter for 3 analyses per project or Pro for unlimited."
        elif context.tier == Tier.STARTER:
            message += " Upgrade to Pro for unlimited analyses."

        logger.warning(
            "SaaS limit check failed for analysis creation",
            extra={
                "user_id": context.user_id,
                "tier": context.tier,
                "resource_type": "analysis",
                "current_count": current_project_analysis_count,
                "limit": max_analyses,
            }
        )
        return False, current_project_analysis_count, max_analyses, message

    @staticmethod
    def can_create_design(context: UserTierContext, current_analysis_design_count: int) -> Tuple[bool, int, Optional[int], str]:
        """
        Check if user can create another design for an analysis.
        """
        limits = TierPolicy._get_tier_limits(context.tier)
        max_designs = limits['max_designs_per_analysis']

        if max_designs is None:
            logger.info(
                "SaaS limit check passed for design creation",
                extra={
                    "user_id": context.user_id,
                    "tier": context.tier,
                    "resource_type": "design",
                    "current_count": current_analysis_design_count,
                    "limit": None,
                }
            )
            return True, current_analysis_design_count, None, "Unlimited designs allowed"

        if current_analysis_design_count < max_designs:
            remaining = max_designs - current_analysis_design_count
            logger.info(
                "SaaS limit check passed for design creation",
                extra={
                    "user_id": context.user_id,
                    "tier": context.tier,
                    "resource_type": "design",
                    "current_count": current_analysis_design_count,
                    "limit": max_designs,
                }
            )
            return True, current_analysis_design_count, max_designs, f"{remaining} design(s) remaining for this analysis"

        tier_name = context.tier.replace('_', ' ').title()
        message = f"{tier_name} tier allows {max_designs} design(s) per analysis. This analysis has {current_analysis_design_count}."

        if context.tier == Tier.FREE:
            message += " Upgrade to Starter or Pro for more designs."
        elif context.tier == Tier.STARTER:
            message += " Upgrade to Pro for unlimited designs."

        logger.warning(
            "SaaS limit check failed for design creation",
            extra={
                "user_id": context.user_id,
                "tier": context.tier,
                "resource_type": "design",
                "current_count": current_analysis_design_count,
                "limit": max_designs,
            }
        )
        return False, current_analysis_design_count, max_designs, message

    @staticmethod
    def can_export_pdf(context: UserTierContext) -> Tuple[bool, str]:
        """
        Check if user can export PDF reports.
        """
        limits = TierPolicy._get_tier_limits(context.tier)
        if limits['can_export_pdf']:
            logger.info(
                "SaaS feature validation passed for PDF export",
                extra={
                    "user_id": context.user_id,
                    "tier": context.tier,
                    "resource_type": "pdf_export",
                }
            )
            return True, "PDF export allowed"

        logger.warning(
            "SaaS feature validation failed for PDF export",
            extra={
                "user_id": context.user_id,
                "tier": context.tier,
                "resource_type": "pdf_export",
            }
        )
        return False, "PDF export requires Starter tier or higher. Upgrade to access this feature."

    @staticmethod
    def can_use_api(context: UserTierContext) -> Tuple[bool, str]:
        """
        Check if user can access API features.
        """
        limits = TierPolicy._get_tier_limits(context.tier)
        if limits['can_use_api']:
            logger.info(
                "SaaS feature validation passed for API access",
                extra={
                    "user_id": context.user_id,
                    "tier": context.tier,
                    "resource_type": "api",
                }
            )
            return True, "API access allowed"

        logger.warning(
            "SaaS feature validation failed for API access",
            extra={
                "user_id": context.user_id,
                "tier": context.tier,
                "resource_type": "api",
            }
        )
        return False, "API access requires Pro tier. Upgrade to access API features."

    @staticmethod
    def get_user_limits(context: UserTierContext) -> Dict[str, Any]:
        """
        Get all limits and permissions for user's current tier.
        """
        limits = TierPolicy._get_tier_limits(context.tier).copy()
        limits['current_tier'] = context.tier
        limits['subscription_active'] = context.subscription_active
        return limits

    @staticmethod
    def check_limit(context: UserTierContext, resource_type: str, **kwargs) -> Tuple[bool, Dict[str, Any]]:
        """
        Generic limit checker for any resource type.
        """
        if resource_type == 'project':
            allowed, current, limit, message = TierPolicy.can_create_project(context)
            return allowed, {
                'resource_type': 'project',
                'current': current,
                'limit': limit,
                'message': message,
                'tier': context.tier
            }

        elif resource_type == 'analysis':
            count = kwargs.get('current_count')
            if count is None:
                raise ValueError("current_count required for analysis limit check")
            allowed, current, limit, message = TierPolicy.can_create_analysis(context, count)
            return allowed, {
                'resource_type': 'analysis',
                'current': current,
                'limit': limit,
                'message': message,
                'tier': context.tier
            }

        elif resource_type == 'design':
            count = kwargs.get('current_count')
            if count is None:
                raise ValueError("current_count required for design limit check")
            allowed, current, limit, message = TierPolicy.can_create_design(context, count)
            return allowed, {
                'resource_type': 'design',
                'current': current,
                'limit': limit,
                'message': message,
                'tier': context.tier
            }

        elif resource_type == 'pdf_export':
            allowed, message = TierPolicy.can_export_pdf(context)
            return allowed, {
                'resource_type': 'pdf_export',
                'message': message,
                'tier': context.tier
            }

        elif resource_type == 'api':
            allowed, message = TierPolicy.can_use_api(context)
            return allowed, {
                'resource_type': 'api',
                'message': message,
                'tier': context.tier
            }

        else:
            raise ValueError(f"Unknown resource type: {resource_type}")
