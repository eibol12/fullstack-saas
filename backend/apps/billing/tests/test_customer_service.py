from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model

from apps.billing.models import Customer
from apps.billing.services import CustomerService, StripeService
import stripe
User = get_user_model()

class CustomerServiceTest(TestCase):
    def setUp(self):
        """Create test user for each test."""
        self.user = User.objects.create_user(
            username="testuser@example.com",
            email="testuser@example.com",
            password="testpass123"
        )

    def test_create_local_customer_only(self):

        customer = CustomerService.create_customer(self.user, ensure_stripe=False)

        self.assertEqual(customer.user, self.user)
        self.assertEqual(customer.tier, Customer.Tier.FREE)
        self.assertFalse(customer.subscription_active)
        self.assertIsNone(customer.stripe_customer_id)
        self.assertEqual(customer.sync_status, Customer.SyncStatus.SYNCED)

    def test_create_customer_idempotent(self):
        """Test that creating customer twice returns same instance."""
        customer1 = CustomerService.create_customer(self.user)
        customer2 = CustomerService.create_customer(self.user)

        self.assertEqual(customer1.id, customer2.id)
        self.assertEqual(Customer.objects.filter(user=self.user).count(), 1)

    @patch("stripe.Customer.create")
    def test_create_stripe_customer(self, mock_stripe_create):
        #Mock stripe response
        mock_stripe_customer = MagicMock()
        mock_stripe_customer.id = "cus_test123"
        mock_stripe_customer.email = self.user.email
        mock_stripe_customer.created = 1234567890
        mock_stripe_create.return_value = mock_stripe_customer

        customer = CustomerService.create_customer(self.user, ensure_stripe=True)

        self.assertEqual(customer.stripe_customer_id, "cus_test123")
        self.assertEqual(customer.sync_status, Customer.SyncStatus.SYNCED)
        self.assertIsNotNone(customer.stripe_data_last_synced)

        # Verify Stripe API was called correctly
        mock_stripe_create.assert_called_once_with(
            email=self.user.email,
            metadata={
                "user_id": str(self.user.id),
                "customer_id": str(customer.id),
            }
        )

    @patch('stripe.Customer.create')
    def test_create_stripe_customer_failure(self, mock_stripe_create):
        mock_stripe_create.side_effect = stripe.error.StripeError("Stripe API Error")

        customer = CustomerService.create_customer(self.user)

        with self.assertRaises(stripe.error.StripeError):
            StripeService.create_customer(customer)

        customer.refresh_from_db()
        self.assertEqual(customer.sync_status, Customer.SyncStatus.FAILED)
        self.assertIn("API Error", customer.sync_error_message)

    #
    # def test_create_customer_with_ensure_stripe(self, mock_create_customer):
    #     user = User.objects.create_user(
    #         username="test2@example.com",
    #         email="test2@example.com",
    #         password="secret123",
    #     )
    #
    #     customer = CustomerService.create_customer(user)
    #     customer.stripe_customer_id = "cus_123"
    #     mock_create_customer.return_value = customer
    #
    #     updated_customer = CustomerService.create_customer(user, ensure_stripe=True)
    #
    #     mock_create_customer.assert_called_once()
    #     self.assertEqual(updated_customer.stripe_customer_id, "cus_123")

# class CustomerServiceTest(TestCase):
#     def test_create_customer_creates_stripe_customer(self):
#
#         def test_create_customer_creates_local_record(self):
#
#         def test_sync_customer_updates_metadata(self):

