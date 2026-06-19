from django.db.models import Count
from apps.billing.models import Customer
from apps.main.models import LiftingAnalysis, RiggingDesign, Project
from domain.saas.types import UserTierContext


class SaaSSelector:
    """
    Application-layer selector for SaaS and billing-related data.
    Provides bridge between Django models and pure domain types.
    """

    @staticmethod
    def get_user_tier_context(user) -> UserTierContext:
        """
        Builds the pure domain context for a user's subscription and usage.
        """
        tier = SaaSSelector._get_customer_tier(user)
        subscription_active = SaaSSelector._has_active_subscription(user)
        project_count = SaaSSelector._count_user_projects(user)
        max_analyses = SaaSSelector._get_max_analyses_in_any_project(user)
        max_designs = SaaSSelector._get_max_designs_in_any_analysis(user)

        return UserTierContext(
            tier=tier,
            subscription_active=subscription_active,
            project_count=project_count,
            max_analyses_in_any_project=max_analyses,
            max_designs_in_any_analysis=max_designs,
            user_id=getattr(user, "id", None)
        )

    @staticmethod
    def _get_customer_tier(user) -> str:
        try:
            customer = Customer.objects.get(user=user)
            if customer.tier in [Customer.Tier.STARTER, Customer.Tier.PRO] and not customer.subscription_active:
                return Customer.Tier.FREE
            return customer.tier
        except (AttributeError, Customer.DoesNotExist):
            return Customer.Tier.FREE

    @staticmethod
    def _has_active_subscription(user) -> bool:
        try:
            customer = Customer.objects.get(user=user)
            return customer.subscription_active
        except (AttributeError, Customer.DoesNotExist):
            return False

    @staticmethod
    def _count_user_projects(user) -> int:
        return user.projects.count()

    @staticmethod
    def _get_max_analyses_in_any_project(user) -> int:
        result = (
            LiftingAnalysis.objects
            .filter(project__owner=user)
            .values('project')
            .annotate(total=Count('id'))
            .order_by('-total')
            .first()
        )
        return result['total'] if result else 0

    @staticmethod
    def _get_max_designs_in_any_analysis(user) -> int:
        result = (
            RiggingDesign.objects
            .filter(analysis__project__owner=user)
            .values('analysis')
            .annotate(total=Count('id'))
            .order_by('-total')
            .first()
        )
        return result['total'] if result else 0

    @staticmethod
    def count_project_analyses(project: Project) -> int:
        return project.analyses.count()

    @staticmethod
    def count_analysis_designs(analysis: LiftingAnalysis) -> int:
        return analysis.designs.count()
