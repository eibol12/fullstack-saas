"""
Tests for TierPolicy domain logic and SaaSSelector application logic.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model

from apps.billing.models import Customer
from apps.main.models import Project, LiftingAnalysis, RiggingDesign
from apps.billing.selectors import SaaSSelector
from domain.saas.tier_policy import TierPolicy
from domain.saas.types import Tier

User = get_user_model()


class TierPolicyIntegrationTestCase(TestCase):
    """
    Integration tests for TierPolicy using SaaSSelector to provide context.
    This verifies that the application and domain layers work correctly together.
    """

    def setUp(self):
        """Create test users for each tier."""
        # Free tier user
        self.free_user = User.objects.create_user(
            username='free@example.com',
            email='free@example.com',
            password='testpass123'
        )
        self.free_customer = Customer.objects.get(user=self.free_user)
        self.free_customer.tier = Customer.Tier.FREE
        self.free_customer.save()

        # Starter tier user
        self.starter_user = User.objects.create_user(
            username='starter@example.com',
            email='starter@example.com',
            password='testpass123'
        )
        self.starter_customer = Customer.objects.get(user=self.starter_user)
        self.starter_customer.tier = Customer.Tier.STARTER
        self.starter_customer.subscription_active = True
        self.starter_customer.save()

        # Pro tier user
        self.pro_user = User.objects.create_user(
            username='pro@example.com',
            email='pro@example.com',
            password='testpass123'
        )
        self.pro_customer = Customer.objects.get(user=self.pro_user)
        self.pro_customer.tier = Customer.Tier.PRO
        self.pro_customer.subscription_active = True
        self.pro_customer.save()

    def test_get_customer_tier_via_selector(self):
        """Test getting customer tier via selector context."""
        free_ctx = SaaSSelector.get_user_tier_context(self.free_user)
        starter_ctx = SaaSSelector.get_user_tier_context(self.starter_user)
        pro_ctx = SaaSSelector.get_user_tier_context(self.pro_user)
        
        self.assertEqual(free_ctx.tier, Tier.FREE)
        self.assertEqual(starter_ctx.tier, Tier.STARTER)
        self.assertEqual(pro_ctx.tier, Tier.PRO)

    def test_can_create_project_free_tier(self):
        """Test free tier project limits (1 project)."""
        # Can create first project
        context = SaaSSelector.get_user_tier_context(self.free_user)
        allowed, current, limit, message = TierPolicy.can_create_project(context)
        self.assertTrue(allowed)
        self.assertEqual(current, 0)
        self.assertEqual(limit, 1)

        # Create one project
        Project.objects.create(name="Project 1", owner=self.free_user)

        # Cannot create second project
        context = SaaSSelector.get_user_tier_context(self.free_user)
        allowed, current, limit, message = TierPolicy.can_create_project(context)
        self.assertFalse(allowed)
        self.assertEqual(current, 1)
        self.assertEqual(limit, 1)

    def test_can_create_analysis_free_tier(self):
        """Test free tier analysis limits (1 per project)."""
        project = Project.objects.create(name="Test Project", owner=self.free_user)

        # Can create first analysis
        context = SaaSSelector.get_user_tier_context(self.free_user)
        current_count = SaaSSelector.count_project_analyses(project)
        allowed, current, limit, message = TierPolicy.can_create_analysis(context, current_count)
        self.assertTrue(allowed)
        self.assertEqual(current, 0)
        self.assertEqual(limit, 1)

        # Create one analysis
        LiftingAnalysis.objects.create(
            project=project,
            name="Analysis 1",
            maximum_gross_weight=1000,
            location=LiftingAnalysis.LocationChoices.OFFSHORE,
            lifting_points_qty=LiftingAnalysis.LiftingPointsChoices.FOUR,
            configuration={},
            results={}
        )

        # Cannot create second analysis
        context = SaaSSelector.get_user_tier_context(self.free_user)
        current_count = SaaSSelector.count_project_analyses(project)
        allowed, current, limit, message = TierPolicy.can_create_analysis(context, current_count)
        self.assertFalse(allowed)
        self.assertEqual(current, 1)

    def test_can_export_pdf_free_tier(self):
        """Test free tier cannot export PDF."""
        context = SaaSSelector.get_user_tier_context(self.free_user)
        allowed, message = TierPolicy.can_export_pdf(context)
        self.assertFalse(allowed)

    def test_can_export_pdf_pro_tier(self):
        """Test pro tier can export PDF."""
        context = SaaSSelector.get_user_tier_context(self.pro_user)
        allowed, message = TierPolicy.can_export_pdf(context)
        self.assertTrue(allowed)

    def test_get_user_limits(self):
        """Test getting complete user limits."""
        context = SaaSSelector.get_user_tier_context(self.free_user)
        free_limits = TierPolicy.get_user_limits(context)
        self.assertEqual(free_limits['max_projects'], 1)
        self.assertEqual(free_limits['current_tier'], Tier.FREE)
        self.assertFalse(free_limits['subscription_active'])

    def test_check_limit_generic(self):
        """Test generic limit checker."""
        context = SaaSSelector.get_user_tier_context(self.free_user)
        allowed, details = TierPolicy.check_limit(context, 'project')
        self.assertTrue(allowed)
        self.assertEqual(details['resource_type'], 'project')
