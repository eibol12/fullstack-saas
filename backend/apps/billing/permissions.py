"""
Django REST Framework permissions for tier-based access control.

These permission classes can be used as decorators on API views to enforce
tier limits and feature access restrictions.
"""
from rest_framework.permissions import BasePermission
from domain.saas.tier_policy import TierPolicy
from domain.saas.types import Tier
from apps.billing.models import Customer
from .selectors import SaaSSelector


class HasActiveSubscription(BasePermission):
    """
    Require user to have an active paid subscription.
    """
    message = "Active subscription required to access this feature."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        context = SaaSSelector.get_user_tier_context(request.user)
        return context.subscription_active


class RequiresTier(BasePermission):
    """
    Base class for requiring a minimum tier level.
    """
    required_tier = None  # Override in subclass
    message = "Insufficient tier. Upgrade required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if self.required_tier is None:
            raise ValueError("required_tier must be set in subclass")

        context = SaaSSelector.get_user_tier_context(request.user)
        user_tier = context.tier

        # Define tier hierarchy
        tier_hierarchy = {
            Tier.FREE: 0,
            Tier.STARTER: 1,
            Tier.PRO: 2,
        }

        user_level = tier_hierarchy.get(user_tier, 0)
        required_level = tier_hierarchy.get(self.required_tier, 0)

        if user_level < required_level:
            self.message = f"{self.required_tier.replace('_', ' ').title()} tier or higher required."
            return False

        return True


class RequiresStarterOrPro(RequiresTier):
    """Require Starter tier or higher."""
    required_tier = Tier.STARTER
    message = "Starter tier or higher required to access this feature."


class RequiresPro(RequiresTier):
    """Require Pro tier."""
    required_tier = Tier.PRO
    message = "Pro tier required to access this feature."


class CanExportPDF(BasePermission):
    """
    Check if user's tier allows PDF export.
    """
    message = "PDF export requires Starter tier or higher. Upgrade to access this feature."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        context = SaaSSelector.get_user_tier_context(request.user)
        allowed, message = TierPolicy.can_export_pdf(context)
        if not allowed:
            self.message = message

        return allowed


class CanUseAPI(BasePermission):
    """
    Check if user's tier allows API access.
    """
    message = "API access requires Pro tier. Upgrade to access API features."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        context = SaaSSelector.get_user_tier_context(request.user)
        allowed, message = TierPolicy.can_use_api(context)
        if not allowed:
            self.message = message

        return allowed


class CanCreateProject(BasePermission):
    """
    Check if user can create another project based on tier limits.
    """
    message = "Project limit exceeded for your tier."

    def has_permission(self, request, view):
        if request.method not in ['POST']:
            return True

        if not request.user or not request.user.is_authenticated:
            return False

        context = SaaSSelector.get_user_tier_context(request.user)
        allowed, current, limit, message = TierPolicy.can_create_project(context)

        if not allowed:
            self.message = message

        return allowed


class CanCreateAnalysis(BasePermission):
    """
    Check if user can create another analysis in a project based on tier limits.
    """
    message = "Analysis limit exceeded for your tier."

    def has_permission(self, request, view):
        if request.method not in ['POST']:
            return True

        if not request.user or not request.user.is_authenticated:
            return False

        project_id = request.data.get('project_id')
        if not project_id:
            return True

        from apps.main.models import Project
        try:
            project = Project.objects.get(id=project_id, owner=request.user)
        except Project.DoesNotExist:
            return True

        context = SaaSSelector.get_user_tier_context(request.user)
        current_count = SaaSSelector.count_project_analyses(project)
        allowed, current, limit, message = TierPolicy.can_create_analysis(context, current_count)

        if not allowed:
            self.message = message

        return allowed


class CanCreateDesign(BasePermission):
    """
    Check if user can create another design for an analysis based on tier limits.
    """
    message = "Design limit exceeded for your tier."

    def has_permission(self, request, view):
        if request.method not in ['POST']:
            return True

        if not request.user or not request.user.is_authenticated:
            return False

        analysis_id = request.data.get('analysis_id')
        if not analysis_id:
            return True

        from apps.main.models import LiftingAnalysis
        try:
            analysis = LiftingAnalysis.objects.get(id=analysis_id, project__owner=request.user)
        except LiftingAnalysis.DoesNotExist:
            return True

        context = SaaSSelector.get_user_tier_context(request.user)
        current_count = SaaSSelector.count_analysis_designs(analysis)
        allowed, current, limit, message = TierPolicy.can_create_design(context, current_count)

        if not allowed:
            self.message = message

        return allowed
