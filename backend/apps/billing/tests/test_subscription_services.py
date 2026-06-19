from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import datetime, timedelta

from apps.billing.models import Customer, Subscription
from apps.billing.services import SubscriptionService
import stripe

User = get_user_model()


class SubscriptionServiceTest(TestCase):
    def setUp(self):
        """Create test user and customer."""
        self.user = User.objects.create_user(
            username="subtest@example.com",
            email="subtest@example.com",
            password="testpass123"
        )

        self.customer = Customer.objects.get(user=self.user)
        self.customer.stripe_customer_id = "cus_test123"
        self.customer.save()

    def test_get_active_subscription_none(self):
        """Test getting active subscription when none exists."""
        active_sub = SubscriptionService.get_active_subscription(self.customer)
        self.assertIsNone(active_sub)

    def test_get_active_subscription_active(self):
        """Test getting active subscription."""
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_test123",
            status= Subscription.Status.ACTIVE,
            tier= Customer.Tier.STARTER,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=30),
        )

        active_sub = SubscriptionService.get_active_subscription(self.customer)
        self.assertEqual(active_sub, subscription)

    def test_get_active_subscription_trialing(self):
        """Test getting trialing subscription."""
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_trial123",
            status= Subscription.Status.TRIALING,
            tier= Customer.Tier.STARTER,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=14),
            trial_end=timezone.now() + timedelta(days=14),
        )

        active_sub = SubscriptionService.get_active_subscription(self.customer)
        self.assertEqual(active_sub.id, subscription.id)

    @patch("stripe.Subscription.modify")
    def test_cancel_subscription(self, mock_stripe_modify):
        """Test canceling subscription at period end."""
        mock_stripe_modify.return_value = {"cancel_at_period_end": True,}

        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_cancel123",
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.STARTER,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=20)
        )

        result = SubscriptionService.cancel_subscription(subscription, cancel_at_period_end=True)

        self.assertTrue(result)
        subscription.refresh_from_db()
        self.assertTrue(subscription.cancel_at_period_end)

        mock_stripe_modify.assert_called_once_with(
            "sub_cancel123",
            cancel_at_period_end=True
        )

    @patch("stripe.Subscription.delete")
    def test_cancel_subscription_immediately(self, mock_stripe_delete):
        """Test canceling subscription immediately."""
        mock_stripe_delete.return_value = {"status": Subscription.Status.CANCELED,}

        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_immediate123",
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.STARTER,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=20)
        )

        result = SubscriptionService.cancel_subscription(subscription, cancel_at_period_end=False)
        self.assertTrue(result)
        subscription.refresh_from_db()
        self.assertEqual(subscription.status, Subscription.Status.CANCELED)
        self.assertIsNotNone(subscription.ended_at)

    @patch('stripe.Subscription.modify')
    def test_reactivate_subscription(self, mock_stripe_modify):
        """Test reactivating a subscription set to cancel."""
        mock_stripe_modify.return_value = {'cancel_at_period_end': False}

        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_reactivate123",
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.STARTER,
            cancel_at_period_end=True,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=10)
        )

        result = SubscriptionService.reactivate_subscription(subscription)

        self.assertTrue(result)
        subscription.refresh_from_db()
        self.assertFalse(subscription.cancel_at_period_end)

        mock_stripe_modify.assert_called_once_with(
            "sub_reactivate123",
            cancel_at_period_end=False
        )

    def test_reactivate_subscription_not_canceling(self):
        """Test reactivating subscription that isn't set to cancel."""
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id="sub_notcanceling123",
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.PRO,
            cancel_at_period_end=False,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=25)
        )

        result = SubscriptionService.reactivate_subscription(subscription)
        self.assertFalse(result)



