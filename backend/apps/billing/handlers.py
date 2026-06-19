"""
Stripe webhook event handlers.

These handlers process webhook events from Stripe with:
- Idempotent processing (no duplicate handling)
- Atomic transactions (all-or-nothing updates)
- Error tracking and retry support
- Graceful degradation if sync fails
"""
from datetime import datetime
from datetime import timezone as datetime_timezone
from django.db import transaction
from django.utils import timezone
import stripe

import sentry_sdk
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from apps.billing.models import Customer, Subscription, StripeWebhookEvent
import logging

logger = logging.getLogger(__name__)


class WebhookHandler:
    """Base class for webhook handlers with idempotency and error handling."""

    def __init__(self, event):
        """
        Initialize handler with Stripe event object or dict.

        Args:
            event: Stripe event object from webhook
        """

        self.event = event
        self.event_id = event["id"]
        self.event_type = event["type"]
        self.data = event["data"]["object"]

        # Determine customer_id and subscription_id where applicable
        self.customer_id = None
        self.subscription_id = None
        if self.event_type.startswith("customer.subscription."):
            self.subscription_id = self.data.get("id")
            self.customer_id = self.data.get("customer")
        elif self.event_type.startswith("customer."):
            self.customer_id = self.data.get("id")
        elif self.event_type.startswith("invoice."):
            self.customer_id = self.data.get("customer")
            self.subscription_id = self.data.get("subscription")
        else:
            self.customer_id = self.data.get("customer")
            self.subscription_id = self.data.get("subscription")

    def process(self):
        """
        Process the webhook event with idempotency check.

        Returns:
            tuple: (success: bool, webhook_event: StripeWebhookEvent)
        """
        extra_ctx = {
            "stripe_event_id": self.event_id,
            "event_type": self.event_type,
        }
        if self.customer_id:
            extra_ctx["customer_id"] = str(self.customer_id)
        if self.subscription_id:
            extra_ctx["subscription_id"] = str(self.subscription_id)

        logger.info("Webhook processing started", extra=extra_ctx)

        # Check if event already processed (idempotency)
        from django.core.serializers.json import DjangoJSONEncoder
        import json
        
        # Serialize the event to a JSON string then back to dict to handle Decimals
        serializable_event = json.loads(json.dumps(self.event, cls=DjangoJSONEncoder))
        
        webhook_event, created = StripeWebhookEvent.objects.get_or_create(
            stripe_event_id=self.event_id,
            defaults={
                'event_type': self.event_type,
                'raw_payload': serializable_event,
                'processing_status': StripeWebhookEvent.ProcessingStatus.PENDING,
            }
        )

        if not created:
            # Event already exists
            if webhook_event.processing_status == StripeWebhookEvent.ProcessingStatus.SUCCEEDED:
                logger.warning(f"Webhook {self.event_id} already processed successfully. Skipping.", extra=extra_ctx)
                return True, webhook_event
            elif webhook_event.processing_status == StripeWebhookEvent.ProcessingStatus.PROCESSING:
                logger.warning(f"Webhook {self.event_id} is currently being processed. Skipping.", extra=extra_ctx)
                return True, webhook_event

        # Mark as processing
        webhook_event.processing_status = StripeWebhookEvent.ProcessingStatus.PROCESSING
        webhook_event.processing_started_at = timezone.now()
        webhook_event.save(update_fields=['processing_status', 'processing_started_at'])

        try:
            with transaction.atomic():
                # Call the specific handler implementation
                self.handle()

                # Mark as succeeded
                webhook_event.processing_status = StripeWebhookEvent.ProcessingStatus.SUCCEEDED
                webhook_event.processing_completed_at = timezone.now()
                webhook_event.error_message = ""
                webhook_event.save(update_fields=[
                    'processing_status',
                    'processing_completed_at',
                    'error_message'
                ])

                logger.info("Webhook processed successfully", extra=extra_ctx)
                return True, webhook_event

        except Exception as e:
            # Mark as failed and log error
            webhook_event.processing_status = StripeWebhookEvent.ProcessingStatus.FAILED
            webhook_event.processing_completed_at = timezone.now()
            webhook_event.error_message = str(e)
            webhook_event.retry_count += 1
            webhook_event.last_retry_at = timezone.now()
            webhook_event.save(update_fields=[
                'processing_status',
                'processing_completed_at',
                'error_message',
                'retry_count',
                'last_retry_at'
            ])

            if isinstance(e, (ValueError, DjangoValidationError, DRFValidationError)):
                logger.exception("Webhook processing failed due to validation error", extra=extra_ctx)
            else:
                logger.exception("Webhook processing failed", extra=extra_ctx)
                sentry_sdk.capture_exception(e)
            return False, webhook_event

    def handle(self):
        """
        Override this method in subclasses to implement specific event handling.
        Must be implemented in atomic transaction context.
        """
        raise NotImplementedError("Subclasses must implement handle() method")


class CustomerCreatedHandler(WebhookHandler):
    """Handle customer.created events."""

    def handle(self):
        stripe_customer_id = self.data['id']
        email = self.data.get('email')
        metadata = self.data.get('metadata', {})

        logger.info(f"Processing customer.created for {stripe_customer_id}")

        # Try to find customer by stripe_customer_id
        try:
            customer = Customer.objects.get(stripe_customer_id=stripe_customer_id)
            # Update sync info
            customer.stripe_data_last_synced = timezone.now()
            customer.sync_status = Customer.SyncStatus.SYNCED
            customer.stripe_metadata = metadata
            customer.save(update_fields=[
                'stripe_data_last_synced',
                'sync_status',
                'stripe_metadata'
            ])
            logger.info(f"Updated existing customer {customer.id}")

        except Customer.DoesNotExist:
            logger.warning(f"Customer with stripe_customer_id {stripe_customer_id} not found. "
                          f"This typically means customer was created in Stripe first.")
            # Optionally create a placeholder customer if you want to handle Stripe-first workflow
            # For MVP, we assume customers are created in Django first


class CustomerUpdatedHandler(WebhookHandler):
    """Handle customer.updated events."""

    def handle(self):
        stripe_customer_id = self.data['id']
        email = self.data.get('email')
        metadata = self.data.get('metadata', {})

        try:
            customer = Customer.objects.get(stripe_customer_id=stripe_customer_id)
            customer.stripe_metadata = metadata
            customer.stripe_data_last_synced = timezone.now()
            customer.sync_status = Customer.SyncStatus.SYNCED
            customer.save(update_fields=[
                'stripe_metadata',
                'stripe_data_last_synced',
                'sync_status'
            ])
            logger.info(f"Updated customer {customer.id} from Stripe")

        except Customer.DoesNotExist:
            logger.error(f"Customer with stripe_customer_id {stripe_customer_id} not found")
            raise


class SubscriptionCreatedHandler(WebhookHandler):
    @staticmethod
    def _ts_to_dt(value):
        return datetime.fromtimestamp(value, tz=datetime_timezone.utc) if value else None

    def handle(self):
        stripe_subscription_id = self.data["id"]
        stripe_customer_id = self.data["customer"]

        customer = Customer.objects.get(stripe_customer_id=stripe_customer_id)

        items = self.data.get("items", {}).get("data", [])
        first_item = items[0] if items else {}

        price = first_item.get("price", {})
        product = price.get("product", {}) if isinstance(price, dict) else {}

        stripe_product_id = product.get("id", "") if isinstance(product, dict) else (product or "")
        stripe_price_id = price.get("id", "") if isinstance(price, dict) else ""

        # Determine tier from product metadata or plan metadata
        product_metadata = product.get("metadata", {}) if isinstance(product, dict) else {}
        plan_metadata = first_item.get("plan", {}).get("metadata", {})
        tier_name = product_metadata.get("tier") or plan_metadata.get("tier", "free")
        tier_name = tier_name.lower()

        tier_mapping = {
            "free": Customer.Tier.FREE,
            "starter": Customer.Tier.STARTER,
            "pro": Customer.Tier.PRO,
        }
        tier = tier_mapping.get(tier_name, Customer.Tier.FREE)

        # Extract period timestamps - they're in the subscription_item level
        period_start_ts = first_item.get("current_period_start")
        period_end_ts = first_item.get("current_period_end")

        # Fallback to Stripe API only if truly missing (shouldn't happen in practice)
        if period_start_ts is None or period_end_ts is None:
            logger.warning(
                f"Missing period timestamps for subscription {stripe_subscription_id}. "
                f"Falling back to Stripe API retrieve."
            )
            stripe_sub = stripe.Subscription.retrieve(stripe_subscription_id)
            # In full subscription object, periods are at subscription_item level too
            stripe_items = stripe_sub.get("items", {}).get("data", [])
            stripe_first_item = stripe_items[0] if stripe_items else {}
            period_start_ts = period_start_ts or stripe_first_item.get("current_period_start")
            period_end_ts = period_end_ts or stripe_first_item.get("current_period_end")

        subscription, created = Subscription.objects.update_or_create(
            stripe_subscription_id=stripe_subscription_id,
            defaults={
                "customer": customer,
                "stripe_product_id": stripe_product_id,
                "stripe_price_id": stripe_price_id,
                "status": self.data["status"],
                "tier": tier,
                "current_period_start": self._ts_to_dt(period_start_ts),
                "current_period_end": self._ts_to_dt(period_end_ts),
                "trial_start": self._ts_to_dt(self.data.get("trial_start")),
                "trial_end": self._ts_to_dt(self.data.get("trial_end")),
                "cancel_at_period_end": self.data.get("cancel_at_period_end", False),
                "canceled_at": self._ts_to_dt(self.data.get("canceled_at")),
                "ended_at": self._ts_to_dt(self.data.get("ended_at")),
                "stripe_metadata": self.data.get("metadata", {}),
            },
        )

        logger.info(f"{'Created' if created else 'Updated'} subscription {subscription.id}")


class SubscriptionUpdatedHandler(WebhookHandler):
    """Handle customer.subscription.updated events."""

    def handle(self):
        # Reuse the same logic as creation
        SubscriptionCreatedHandler(self.event).handle()


class SubscriptionDeletedHandler(WebhookHandler):
    """Handle customer.subscription.deleted events."""

    def handle(self):
        stripe_subscription_id = self.data['id']

        try:
            subscription = Subscription.objects.get(stripe_subscription_id=stripe_subscription_id)
            subscription.status = Subscription.Status.CANCELED
            subscription.ended_at = timezone.now()
            subscription.save(update_fields=['status', 'ended_at'])
            logger.info(f"Marked subscription {subscription.id} as canceled")

        except Subscription.DoesNotExist:
            logger.warning(f"Subscription {stripe_subscription_id} not found for deletion")


class InvoicePaidHandler(WebhookHandler):
    """Handle invoice.paid events."""

    def handle(self):
        invoice_id = self.data["id"]
        stripe_customer_id = self.data.get("customer")
        stripe_subscription_id = self.data.get("subscription")
        amount_paid = self.data.get("amount_paid", 0)

        logger.info(
            f"Processing invoice.paid for invoice {invoice_id}, "
            f"customer {stripe_customer_id}, subscription {stripe_subscription_id}, "
            f"amount {amount_paid}"
        )

        customer = None
        if stripe_customer_id:
            try:
                customer = Customer.objects.get(stripe_customer_id=stripe_customer_id)
                customer.stripe_data_last_synced = timezone.now()
                customer.save(update_fields=["stripe_data_last_synced"])
            except Customer.DoesNotExist:
                logger.warning(f"Customer {stripe_customer_id} not found for invoice {invoice_id}")

        if stripe_subscription_id:
            try:
                subscription = Subscription.objects.get(stripe_subscription_id=stripe_subscription_id)

                # Recompute customer cached access from current subscription state
                if customer:
                    customer.update_tier_from_subscription()

            except Subscription.DoesNotExist:
                logger.warning(f"Subscription {stripe_subscription_id} not found for invoice {invoice_id}")

        logger.info(f"Successfully processed invoice.paid for {invoice_id}")


class InvoicePaymentFailedHandler(WebhookHandler):
    """Handle invoice.payment_failed events."""

    def handle(self):
        invoice_id = self.data["id"]
        stripe_customer_id = self.data.get("customer")
        stripe_subscription_id = self.data.get("subscription")
        amount_due = self.data.get("amount_due", 0)
        attempt_count = self.data.get("attempt_count", 0)

        logger.warning(
            f"Processing invoice.payment_failed for invoice {invoice_id}, "
            f"customer {stripe_customer_id}, subscription {stripe_subscription_id}, "
            f"amount due {amount_due}, attempt {attempt_count}"
        )

        customer = None
        if stripe_customer_id:
            try:
                customer = Customer.objects.get(stripe_customer_id=stripe_customer_id)
                customer.stripe_data_last_synced = timezone.now()
                customer.save(update_fields=["stripe_data_last_synced"])
            except Customer.DoesNotExist:
                logger.warning(f"Customer {stripe_customer_id} not found for failed invoice {invoice_id}")

        if stripe_subscription_id:
            try:
                subscription = Subscription.objects.get(stripe_subscription_id=stripe_subscription_id)

                if subscription.status == Subscription.Status.ACTIVE:
                    subscription.status = Subscription.Status.PAST_DUE
                    subscription.save(update_fields=["status"])

                if customer:
                    customer.update_tier_from_subscription()

            except Subscription.DoesNotExist:
                logger.warning(f"Subscription {stripe_subscription_id} not found for failed invoice {invoice_id}")

        logger.warning(f"Payment failed for invoice {invoice_id} - customer attention required")

# Event handler registry
WEBHOOK_HANDLERS = {
    'customer.created': CustomerCreatedHandler,
    'customer.updated': CustomerUpdatedHandler,
    'customer.subscription.created': SubscriptionCreatedHandler,
    'customer.subscription.updated': SubscriptionUpdatedHandler,
    'customer.subscription.deleted': SubscriptionDeletedHandler,
    'invoice.paid': InvoicePaidHandler,
    'invoice.payment_failed': InvoicePaymentFailedHandler,
}



def process_webhook_event(event):
    """
    Process a Stripe webhook event.

    Args:
        event: Stripe event object from webhook

    Returns:
        tuple: (success: bool, webhook_event: StripeWebhookEvent or None)
    """

    event_type = event['type']
    handler_class = WEBHOOK_HANDLERS.get(event_type)

    if not handler_class:
        logger.info(f"No handler for event type {event_type}. Skipping.")
        from django.core.serializers.json import DjangoJSONEncoder
        import json
        # Store event but mark as skipped
        serializable_event = json.loads(json.dumps(event, cls=DjangoJSONEncoder))
        webhook_event = StripeWebhookEvent.objects.create(
            stripe_event_id=event['id'],
            event_type=event_type,
            raw_payload=serializable_event,
            processing_status=StripeWebhookEvent.ProcessingStatus.SKIPPED,
        )
        return True, webhook_event

    handler = handler_class(event)
    return handler.process()

