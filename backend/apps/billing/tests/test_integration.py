from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model

from apps.billing.models import Customer, Subscription
from apps.billing.services import CustomerService, StripeService

User = get_user_model()


class BillingIntegrationTest(TestCase):
    """Test the complete billing flow end-to-end."""

    @patch('stripe.Customer.create')
    @patch('stripe.checkout.Session.create')
    def test_complete_checkout_flow(self, mock_checkout_create, mock_customer_create):
        """Test complete flow from user creation to checkout."""
        # Mock Stripe responses
        mock_stripe_customer = MagicMock()
        mock_stripe_customer.id = "cus_integration123"
        mock_stripe_customer.email = "integration@example.com"
        mock_stripe_customer.created = 1234567890
        mock_customer_create.return_value = mock_stripe_customer

        mock_checkout_session = MagicMock()
        mock_checkout_session.id = "cs_integration123"
        mock_checkout_session.url = "https://checkout.stripe.com/pay/cs_integration123"
        mock_checkout_create.return_value = mock_checkout_session

        # 1. User signs up
        user = User.objects.create_user(
            username="integration@example.com",
            email="integration@example.com",
            password="testpass123"
        )

        # 2. Customer auto-created by signal
        customer = Customer.objects.get(user=user)
        self.assertEqual(customer.tier, Customer.Tier.FREE)
        self.assertIsNone(customer.stripe_customer_id)

        # 3. User clicks "Subscribe" - checkout session created
        session = StripeService.create_checkout_session(
            customer=customer,
            price_id="price_starter123",
            success_url="https://example.com/success",
            cancel_url="https://example.com/cancel"
        )

        # Verify Stripe customer was created
        customer.refresh_from_db()
        self.assertEqual(customer.stripe_customer_id, "cus_integration123")

        # Verify checkout session was created
        self.assertEqual(session.id, "cs_integration123")
        self.assertIn("checkout.stripe.com", session.url)

        mock_checkout_create.assert_called_once()
        call_args = mock_checkout_create.call_args[1]
        self.assertEqual(call_args['customer'], "cus_integration123")
        self.assertEqual(call_args['line_items'][0]['price'], "price_starter123")

    @patch('stripe.Customer.create')
    def test_signal_creates_customer_on_user_creation(self, mock_stripe_create):
        """Test that signal automatically creates customer when user is created."""
        user = User.objects.create_user(
            username="signal@example.com",
            email="signal@example.com",
            password="testpass123"
        )

        # Customer should be auto-created by signal
        customer = Customer.objects.get(user=user)
        self.assertIsNotNone(customer)
        self.assertEqual(customer.tier, Customer.Tier.FREE)
        self.assertFalse(customer.subscription_active)
