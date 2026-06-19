from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

from apps.billing.models import Customer, Subscription

User = get_user_model()

class CustomerModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='modeltestuser@example.com',
            email='modeltestuser@example.com',
            password='testpassword123',
        )

        self.customer = Customer.objects.get(user=self.user)

    def test_customer_str(self):
        self.assertEqual(
            str(self.user.customer),
            f'Customer: {self.user.email} ({self.user.customer.tier})'
        )

    def test_update_tier_from_subscription_no_subscription(self):
        """Test tier update when no active subscription."""
        self.customer.tier = Customer.Tier.PRO
        self.customer.subscription_active = True
        self.customer.save()

        self.customer.update_tier_from_subscription()

        self.assertEqual(self.customer.tier, Customer.Tier.FREE)
        self.assertFalse(self.customer.subscription_active)

    def test_update_tier_from_subscription_with_active(self):
        """Test tier update with active subscription."""
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_model123",
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.PRO,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=30)
        )

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.tier, Customer.Tier.PRO)
        self.assertTrue(self.customer.subscription_active)

    def test_update_tier_from_subscription_chooses_latest(self):
        """Test that it picks the subscription with latest period_end."""
        # Old subscription
        Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_old123",
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.STARTER,
            current_period_start=timezone.now() - timedelta(days=60),
            current_period_end=timezone.now() - timedelta(days=30)
        )

        # New subscription
        Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_new123",
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.PRO,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=30)
        )

        self.customer.update_tier_from_subscription()
        self.assertEqual(self.customer.tier, Customer.Tier.PRO)

class SubscriptionModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="submodel@example.com",
            email="submodel@example.com",
            password="testpass123"
        )
        self.customer = Customer.objects.get(user=self.user)

    def test_subscription_str(self):
        """Test subscription string representation."""
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_str123",
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.STARTER,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=30)
        )

        expected = f"Subscription sub_str123 - {self.customer.user.email} (starter - active)"
        self.assertEqual(str(subscription), expected)

    def test_is_active_for_active_status(self):
        """Test is_active() returns True for active subscription."""
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_active123",
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.PRO,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=30)
        )

        self.assertTrue(subscription.is_active())

    def test_is_active_for_trialing_status(self):
        """Test is_active() returns True for trialing subscription."""
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_trial123",
            status=Subscription.Status.TRIALING,
            tier=Customer.Tier.STARTER,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=14),
            trial_end=timezone.now() + timedelta(days=14)
        )

        self.assertTrue(subscription.is_active())

    def test_is_active_false_for_canceled(self):
        """Test is_active() returns False for canceled subscription."""
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_canceled123",
            status=Subscription.Status.CANCELED,
            tier=Customer.Tier.STARTER,
            current_period_start=timezone.now() - timedelta(days=30),
            current_period_end=timezone.now() - timedelta(days=1)
        )

        self.assertFalse(subscription.is_active())

    def test_save_updates_customer_tier(self):
        """Test that saving subscription updates customer tier."""
        self.assertEqual(self.customer.tier, Customer.Tier.FREE)

        Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_autoupdate123",
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.PRO,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=30)
        )

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.tier, Customer.Tier.PRO)
        self.assertTrue(self.customer.subscription_active)