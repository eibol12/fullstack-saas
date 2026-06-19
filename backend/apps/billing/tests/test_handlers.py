from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import datetime

from apps.billing.models import Customer, Subscription, StripeWebhookEvent
from apps.billing.handlers import (
    SubscriptionCreatedHandler,
    SubscriptionUpdatedHandler,
    SubscriptionDeletedHandler,
    InvoicePaidHandler,
    InvoicePaymentFailedHandler,
    process_webhook_event
)

User = get_user_model()

class WebhookHandlerTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(
            username="webhook@example.com",
            email="webhook@example.com",
            password="testpass123"
        )

        self.customer = Customer.objects.get(user=self.user)
        self.customer.stripe_customer_id = "cus_webhook123"
        self.customer.save()

    def test_subscription_created_handler(self):
        """Test handling customer.subscription.created event."""
        event = {
            "id": "evt_sub_created_123",
            "type": "customer.subscription.created",
            "data": {
                "object": {
                    "id": "sub_new123",
                    "customer": "cus_webhook123",
                    "status": "active",
                    "current_period_start": 1234567890,
                    "current_period_end": 1237159890,
                    "trial_start": None,
                    "trial_end": None,
                    "canceled_at": None,
                    "ended_at": None,
                    "cancel_at_period_end": False,
                    'metadata': {},
                    'items': {
                        'data': [{
                            'current_period_start': 1234567890,
                            'current_period_end': 1237159890,
                            'price': {
                                'id': 'price_new123',
                                'product': {
                                    'id': 'prod_starter',
                                    'metadata': {'tier': 'starter'}
                                },
                            }
                        }]
                    }
                }
            }
        }

        success, webhook_event = process_webhook_event(event)
        self.assertTrue(success)
        self.assertEqual(webhook_event.processing_status, StripeWebhookEvent.ProcessingStatus.SUCCEEDED)

        #Check subscription was created
        subscription = Subscription.objects.get(stripe_subscription_id="sub_new123")
        self.assertEqual(subscription.customer, self.customer)
        self.assertEqual(subscription.tier, Customer.Tier.STARTER)
        self.assertEqual(subscription.status, Subscription.Status.ACTIVE)

        #Check customer tier was updated
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.tier, Customer.Tier.STARTER)
        self.assertTrue(self.customer.subscription_active)

    def test_subscription_created_idempotency(self):
        """Test that processing same event twice doesn't duplicate."""
        event = {
            'id': 'evt_idempotent_123',
            'type': 'customer.subscription.created',
            'data': {
                'object': {
                    'id': 'sub_idempotent123',
                    'customer': 'cus_webhook123',
                    'status': 'trialing',
                    'current_period_start': 1234567890,
                    'current_period_end': 1237159890,
                    'trial_start': 1234567890,
                    'trial_end': 1235777890,
                    'canceled_at': None,
                    'ended_at': None,
                    'cancel_at_period_end': False,
                    'metadata': {},
                    'items': {
                        'data': [{
                            'current_period_start': 1234567890,
                            'current_period_end': 1237159890,
                            'price': {
                                'id': 'price_pro123',
                                'product': {
                                    'id': 'prod_pro',
                                    'metadata': {'tier': 'pro'}
                                }
                            }
                        }]
                    }
                }
            }
        }

        #Process first time
        success1 , webhook_event1 = process_webhook_event(event)
        self.assertTrue(success1)

        # Process second time - it should skip
        success2 , webhook_event2 = process_webhook_event(event)
        self.assertTrue(success2)
        self.assertEqual(webhook_event1.id, webhook_event2.id)

        #Check only one subscription exists.
        self.assertEqual(Subscription.objects.filter(stripe_subscription_id='sub_idempotent123').count(), 1)


    def test_subscription_updated_handler(self):
        """Test handling customer.subscription.updated event."""
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id='sub_update123',
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.STARTER,
            current_period_start=timezone.now(),
            current_period_end=timezone.now()
        )

        event = {
            'id': 'evt_sub_updated_123',
            'type': 'customer.subscription.updated',
            'data': {
                'object': {
                    'id': 'sub_update123',
                    'customer': 'cus_webhook123',
                    'status': 'active',
                    'current_period_start': 1234567890,
                    'current_period_end': 1237159890,
                    'trial_start': None,
                    'trial_end': None,
                    'canceled_at': None,
                    'ended_at': None,
                    'cancel_at_period_end': True,  # Customer canceled
                    'metadata': {},
                    'items': {
                        'data': [{
                            'current_period_start': 1234567890,
                            'current_period_end': 1237159890,
                            'price': {
                                'id': 'price_starter123',
                                'product': {
                                    'id': 'prod_starter',
                                    'metadata': {'tier': 'starter'}
                                }
                            }
                        }]
                    }
                }
            }
        }

        success, webhook_event = process_webhook_event(event)

        self.assertTrue(success)

        subscription.refresh_from_db()
        self.assertTrue(subscription.cancel_at_period_end)

    def test_subscription_deleted_handler(self):
        """Test handling customer.subscription.deleted event."""
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id='sub_delete123',
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.PRO,
            current_period_start=timezone.now(),
            current_period_end=timezone.now()
        )

        event = {
            'id': 'evt_sub_deleted_123',
            'type': 'customer.subscription.deleted',
            'data': {
                'object': {
                    'id': 'sub_delete123',
                    'customer': 'cus_webhook123',
                    'status': 'canceled',
                }
            }
        }

        success, webhook_event = process_webhook_event(event)

        self.assertTrue(success)

        subscription.refresh_from_db()
        self.assertEqual(subscription.status, Subscription.Status.CANCELED)
        self.assertIsNotNone(subscription.ended_at)

        # Check customer reverted to free tier
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.tier, Customer.Tier.FREE)
        self.assertFalse(self.customer.subscription_active)

    def test_webhook_event_error_handling(self):
        """Test error handling in webhook processing."""
        event = {
            'id': 'evt_error_123',
            'type': 'customer.subscription.created',
            'data': {
                'object': {
                    'id': 'sub_error123',
                    'customer': 'cus_nonexistent',  # Customer doesn't exist!
                    'status': 'active',
                    'current_period_start': 1234567890,
                    'current_period_end': 1237159890,
                    'trial_start': None,
                    'trial_end': None,
                    'canceled_at': None,
                    'ended_at': None,
                    'cancel_at_period_end': False,
                    'metadata': {},
                    'items': {
                        'data': [{
                            'current_period_start': 1234567890,
                            'current_period_end': 1237159890,
                            'price': {
                                'id': 'price_test',
                                'product': {
                                    'id': 'prod_test',
                                    'metadata': {'tier': 'starter'}
                                }
                            }
                        }]
                    }
                }
            }
        }

        success, webhook_event = process_webhook_event(event)

        self.assertFalse(success)
        self.assertEqual(webhook_event.processing_status, StripeWebhookEvent.ProcessingStatus.FAILED)
        self.assertIn("Customer", webhook_event.error_message)
        self.assertEqual(webhook_event.retry_count, 1)

    def test_invoice_paid_handler(self):
        """Test handling invoice.paid event."""
        # Create subscription for the invoice
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id='sub_invoice_test',
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.STARTER,
            current_period_start=timezone.now(),
            current_period_end=timezone.now()
        )

        event = {
            'id': 'evt_invoice_paid_123',
            'type': 'invoice.paid',
            'data': {
                'object': {
                    'id': 'in_paid123',
                    'customer': 'cus_webhook123',
                    'subscription': 'sub_invoice_test',
                    'status': 'paid',
                    'amount_paid': 2999,
                    'amount_due': 2999,
                }
            }
        }

        # Record initial sync time
        initial_sync_time = self.customer.stripe_data_last_synced

        success, webhook_event = process_webhook_event(event)

        self.assertTrue(success)
        self.assertEqual(webhook_event.processing_status, StripeWebhookEvent.ProcessingStatus.SUCCEEDED)

        # Verify customer sync timestamp was updated
        self.customer.refresh_from_db()
        if initial_sync_time:
            self.assertGreater(self.customer.stripe_data_last_synced, initial_sync_time)
        else:
            self.assertIsNotNone(self.customer.stripe_data_last_synced)

    def test_invoice_paid_idempotency(self):
        """Test that processing same invoice.paid event twice doesn't duplicate."""
        event = {
            'id': 'evt_invoice_idempotent_123',
            'type': 'invoice.paid',
            'data': {
                'object': {
                    'id': 'in_idempotent123',
                    'customer': 'cus_webhook123',
                    'subscription': None,
                    'status': 'paid',
                    'amount_paid': 1000,
                }
            }
        }

        # Process first time
        success1, webhook_event1 = process_webhook_event(event)
        self.assertTrue(success1)

        # Process second time - should skip
        success2, webhook_event2 = process_webhook_event(event)
        self.assertTrue(success2)
        self.assertEqual(webhook_event1.id, webhook_event2.id)

        # Verify only one webhook event exists
        self.assertEqual(
            StripeWebhookEvent.objects.filter(stripe_event_id='evt_invoice_idempotent_123').count(),
            1
        )

    def test_invoice_payment_failed_handler(self):
        """Test handling invoice.payment_failed event."""
        # Create active subscription
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id='sub_failed_payment',
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.PRO,
            current_period_start=timezone.now(),
            current_period_end=timezone.now()
        )

        event = {
            'id': 'evt_invoice_failed_123',
            'type': 'invoice.payment_failed',
            'data': {
                'object': {
                    'id': 'in_failed123',
                    'customer': 'cus_webhook123',
                    'subscription': 'sub_failed_payment',
                    'status': 'open',
                    'amount_due': 4999,
                    'amount_paid': 0,
                    'attempt_count': 2,
                }
            }
        }

        success, webhook_event = process_webhook_event(event)

        self.assertTrue(success)
        self.assertEqual(webhook_event.processing_status, StripeWebhookEvent.ProcessingStatus.SUCCEEDED)

        # Verify subscription was marked as past_due
        subscription.refresh_from_db()
        self.assertEqual(subscription.status, Subscription.Status.PAST_DUE)

    def test_invoice_payment_failed_no_subscription(self):
        """Test handling invoice.payment_failed for invoice without subscription."""
        event = {
            'id': 'evt_invoice_failed_no_sub',
            'type': 'invoice.payment_failed',
            'data': {
                'object': {
                    'id': 'in_failed_no_sub',
                    'customer': 'cus_webhook123',
                    'subscription': None,  # No subscription
                    'status': 'open',
                    'amount_due': 500,
                    'amount_paid': 0,
                    'attempt_count': 1,
                }
            }
        }

        success, webhook_event = process_webhook_event(event)

        # Should still succeed even without subscription
        self.assertTrue(success)
        self.assertEqual(webhook_event.processing_status, StripeWebhookEvent.ProcessingStatus.SUCCEEDED)

    def test_invoice_without_customer(self):
        """Test handling invoice event when customer doesn't exist in DB."""
        event = {
            'id': 'evt_invoice_no_customer',
            'type': 'invoice.paid',
            'data': {
                'object': {
                    'id': 'in_no_customer',
                    'customer': 'cus_nonexistent',
                    'subscription': None,
                    'status': 'paid',
                    'amount_paid': 1000,
                }
            }
        }

        # Should still succeed but log warning
        success, webhook_event = process_webhook_event(event)
        self.assertTrue(success)
        self.assertEqual(webhook_event.processing_status, StripeWebhookEvent.ProcessingStatus.SUCCEEDED)

    def test_invoice_paid_handler(self):
        """Test handling invoice.paid event."""
        # Create subscription for the invoice
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id='sub_invoice_test',
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.STARTER,
            current_period_start=timezone.now(),
            current_period_end=timezone.now()
        )

        event = {
            'id': 'evt_invoice_paid_123',
            'type': 'invoice.paid',
            'data': {
                'object': {
                    'id': 'in_paid123',
                    'customer': 'cus_webhook123',
                    'subscription': 'sub_invoice_test',
                    'status': 'paid',
                    'amount_paid': 2999,
                    'amount_due': 2999,
                }
            }
        }

        # Record initial sync time
        initial_sync_time = self.customer.stripe_data_last_synced

        success, webhook_event = process_webhook_event(event)

        self.assertTrue(success)
        self.assertEqual(webhook_event.processing_status, StripeWebhookEvent.ProcessingStatus.SUCCEEDED)

        # Verify customer sync timestamp was updated
        self.customer.refresh_from_db()
        if initial_sync_time:
            self.assertGreater(self.customer.stripe_data_last_synced, initial_sync_time)
        else:
            self.assertIsNotNone(self.customer.stripe_data_last_synced)

    def test_invoice_paid_idempotency(self):
        """Test that processing same invoice.paid event twice doesn't duplicate."""
        event = {
            'id': 'evt_invoice_idempotent_123',
            'type': 'invoice.paid',
            'data': {
                'object': {
                    'id': 'in_idempotent123',
                    'customer': 'cus_webhook123',
                    'subscription': None,
                    'status': 'paid',
                    'amount_paid': 1000,
                }
            }
        }

        # Process first time
        success1, webhook_event1 = process_webhook_event(event)
        self.assertTrue(success1)

        # Process second time - should skip
        success2, webhook_event2 = process_webhook_event(event)
        self.assertTrue(success2)
        self.assertEqual(webhook_event1.id, webhook_event2.id)

        # Verify only one webhook event exists
        self.assertEqual(
            StripeWebhookEvent.objects.filter(stripe_event_id='evt_invoice_idempotent_123').count(),
            1
        )

    def test_invoice_payment_failed_handler(self):
        """Test handling invoice.payment_failed event."""
        # Create active subscription
        subscription = Subscription.objects.create(
            customer=self.customer,
            stripe_subscription_id='sub_failed_payment',
            status=Subscription.Status.ACTIVE,
            tier=Customer.Tier.PRO,
            current_period_start=timezone.now(),
            current_period_end=timezone.now()
        )

        event = {
            'id': 'evt_invoice_failed_123',
            'type': 'invoice.payment_failed',
            'data': {
                'object': {
                    'id': 'in_failed123',
                    'customer': 'cus_webhook123',
                    'subscription': 'sub_failed_payment',
                    'status': 'open',
                    'amount_due': 4999,
                    'amount_paid': 0,
                    'attempt_count': 2,
                }
            }
        }

        success, webhook_event = process_webhook_event(event)

        self.assertTrue(success)
        self.assertEqual(webhook_event.processing_status, StripeWebhookEvent.ProcessingStatus.SUCCEEDED)

        # Verify subscription was marked as past_due
        subscription.refresh_from_db()
        self.assertEqual(subscription.status, Subscription.Status.PAST_DUE)

    def test_invoice_payment_failed_no_subscription(self):
        """Test handling invoice.payment_failed for invoice without subscription."""
        event = {
            'id': 'evt_invoice_failed_no_sub',
            'type': 'invoice.payment_failed',
            'data': {
                'object': {
                    'id': 'in_failed_no_sub',
                    'customer': 'cus_webhook123',
                    'subscription': None,  # No subscription
                    'status': 'open',
                    'amount_due': 500,
                    'amount_paid': 0,
                    'attempt_count': 1,
                }
            }
        }

        success, webhook_event = process_webhook_event(event)

        # Should still succeed even without subscription
        self.assertTrue(success)
        self.assertEqual(webhook_event.processing_status, StripeWebhookEvent.ProcessingStatus.SUCCEEDED)

    def test_invoice_without_customer(self):
        """Test handling invoice event when customer doesn't exist in DB."""
        event = {
            'id': 'evt_invoice_no_customer',
            'type': 'invoice.paid',
            'data': {
                'object': {
                    'id': 'in_no_customer',
                    'customer': 'cus_nonexistent',
                    'subscription': None,
                    'status': 'paid',
                    'amount_paid': 1000,
                }
            }
        }

        # Should still succeed but log warning
        success, webhook_event = process_webhook_event(event)
        self.assertTrue(success)
        self.assertEqual(webhook_event.processing_status, StripeWebhookEvent.ProcessingStatus.SUCCEEDED)
