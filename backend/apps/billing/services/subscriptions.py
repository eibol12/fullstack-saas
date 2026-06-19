import stripe
from django.utils import timezone
import sentry_sdk
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from apps.billing.models import Subscription
import logging

logger = logging.getLogger(__name__)

class SubscriptionService:
    """
    Service class for managing subscriptions with Stripe.
    """
    @staticmethod
    def get_active_subscription(customer):
        """
        Get customer's active subscription.
        """
        active_subscriptions = customer.subscriptions.filter(
            status__in=[Subscription.Status.ACTIVE, Subscription.Status.TRIALING]
        ).order_by('-current_period_end')

        count = active_subscriptions.count()
        if count > 1:
            logger.warning(
                "Multiple active subscriptions detected for customer",
                extra={
                    "customer_id": str(customer.id),
                    "subscription_ids": list(active_subscriptions.values_list('id', flat=True))
                }
            )

        return active_subscriptions.first()

    @staticmethod
    def cancel_subscription(subscription, cancel_at_period_end=True):
        """
        Cancel subscription in Stripe and update local DB.
        """
        extra = {
            "customer_id": str(subscription.customer.id),
            "subscription_id": str(subscription.id),
            "stripe_subscription_id": subscription.stripe_subscription_id,
            "cancel_at_period_end": cancel_at_period_end,
        }
        logger.info("Canceling subscription", extra=extra)

        try:
            if cancel_at_period_end:
                stripe_subscription = stripe.Subscription.modify(
                    subscription.stripe_subscription_id,
                    cancel_at_period_end=True
                )

                subscription.cancel_at_period_end = True
                subscription.save(update_fields=['cancel_at_period_end'])
            else:
                stripe_subscription = stripe.Subscription.delete(
                    subscription.stripe_subscription_id
                )

                subscription.status = Subscription.Status.CANCELED
                subscription.ended_at = timezone.now()
                subscription.save(update_fields=['status', 'ended_at'])

            logger.info("Canceled subscription successfully", extra=extra)
            return True

        except stripe.error.StripeError as e:
            logger.exception("Failed to cancel subscription due to Stripe API error", extra=extra)
            sentry_sdk.capture_exception(e)
            raise
        except Exception as e:
            logger.exception("Unexpected error while canceling subscription", extra=extra)
            if not isinstance(e, (ValueError, DjangoValidationError, DRFValidationError)):
                sentry_sdk.capture_exception(e)
            raise

    @staticmethod
    def reactivate_subscription(subscription):
        """
        Reactivate a subscription that was set to cancel at period end.
        """
        extra = {
            "customer_id": str(subscription.customer.id),
            "subscription_id": str(subscription.id),
            "stripe_subscription_id": subscription.stripe_subscription_id,
        }

        if not subscription.cancel_at_period_end:
            logger.warning(
                "Subscription is not set to cancel; reactivation skipped",
                extra=extra
            )
            return False

        logger.info("Reactivating subscription", extra=extra)

        try:
            stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                cancel_at_period_end=False
            )

            subscription.cancel_at_period_end = False
            subscription.save(update_fields=['cancel_at_period_end'])

            logger.info("Reactivated subscription successfully", extra=extra)
            return True

        except stripe.error.StripeError as e:
            logger.exception("Failed to reactivate subscription due to Stripe API error", extra=extra)
            sentry_sdk.capture_exception(e)
            raise
        except Exception as e:
            logger.exception("Unexpected error while reactivating subscription", extra=extra)
            if not isinstance(e, (ValueError, DjangoValidationError, DRFValidationError)):
                sentry_sdk.capture_exception(e)
            raise

    @staticmethod
    def update_subscription_plan(subscription, new_price_id):
        """
        Update an existing subscription to a new price/plan.
        """
        if not subscription.is_active():
            raise ValueError(f"Subscription {subscription.id} is not active (status: {subscription.status})")

        if not new_price_id:
            raise ValueError("new_price_id is required")

        extra = {
            "customer_id": str(subscription.customer.id),
            "subscription_id": str(subscription.id),
            "stripe_subscription_id": subscription.stripe_subscription_id,
            "old_price_id": subscription.stripe_price_id,
            "new_price_id": new_price_id,
        }

        if subscription.stripe_price_id == new_price_id:
            logger.info(
                "Subscription already has target price; no update needed",
                extra=extra
            )
            return stripe.Subscription.retrieve(subscription.stripe_subscription_id)

        logger.info("Updating subscription plan", extra=extra)

        try:
            stripe_subscription = stripe.Subscription.retrieve(subscription.stripe_subscription_id)

            if not stripe_subscription.items or not stripe_subscription.items.data:
                raise ValueError(f"No subscription items found for subscription {subscription.stripe_subscription_id}")

            subscription_item = stripe_subscription['items']['data'][0]
            subscription_item_id = subscription_item['id']

            updated_subscription = stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                items=[{
                    'id': subscription_item_id,
                    'price': new_price_id,
                }],
                proration_behavior='always_invoice',
            )

            logger.info("Updated subscription plan successfully", extra=extra)
            return updated_subscription

        except stripe.error.StripeError as e:
            logger.exception("Failed to update subscription plan due to Stripe API error", extra=extra)
            sentry_sdk.capture_exception(e)
            raise
        except Exception as e:
            logger.exception("Unexpected error while updating subscription plan", extra=extra)
            if not isinstance(e, (ValueError, DjangoValidationError, DRFValidationError)):
                sentry_sdk.capture_exception(e)
            raise
