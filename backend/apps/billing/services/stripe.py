import stripe
from django.conf import settings
from django.utils import timezone
import sentry_sdk
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from apps.billing.models import Customer
import logging

logger = logging.getLogger(__name__)

# Configure Stripe API key
stripe.api_key = settings.STRIPE_API_KEY

class StripeService:
    """Service for Stripe API interactions"""
    @staticmethod
    def create_customer(customer: Customer):
        """
        Create a stripe customer and link it to local customer.
        """
        if customer.stripe_customer_id:
            return customer
        
        extra = {
            "user_id": str(customer.user.id),
            "customer_id": str(customer.id),
        }
        logger.info("Creating Stripe customer", extra=extra)

        try:
            stripe_customer = stripe.Customer.create(
                email = customer.user.email,
                metadata = {
                    "user_id": str(customer.user.id),
                    "customer_id": str(customer.id),
                }
            )

            customer.stripe_customer_id = stripe_customer.id
            customer.stripe_metadata = {
                "id": stripe_customer.id,
                "email": stripe_customer.email,
                "created": stripe_customer.created,
            }
            customer.stripe_data_last_synced = timezone.now()
            customer.sync_status = Customer.SyncStatus.SYNCED
            customer.sync_error_message = ""

            customer.save(
                update_fields=[
                    "stripe_customer_id",
                    "stripe_metadata",
                    "stripe_data_last_synced",
                    "sync_status",
                    "sync_error_message",
                ]
            )
            logger.info("Created Stripe customer", extra={**extra, "stripe_customer_id": stripe_customer.id})
            return customer

        except stripe.error.StripeError as e:
            logger.exception("Failed to create Stripe customer due to Stripe API error", extra=extra)
            sentry_sdk.capture_exception(e)
            customer.sync_status = Customer.SyncStatus.FAILED
            customer.sync_error_message = str(e)
            customer.save(update_fields=["sync_status", "sync_error_message"])
            raise
        except Exception as e:
            logger.exception("Unexpected error while creating Stripe customer", extra=extra)
            if not isinstance(e, (ValueError, DjangoValidationError, DRFValidationError)):
                sentry_sdk.capture_exception(e)
            customer.sync_status = Customer.SyncStatus.FAILED
            customer.sync_error_message = str(e)
            customer.save(update_fields=["sync_status", "sync_error_message"])
            raise

    @staticmethod
    def create_checkout_session(customer, price_id, success_url, cancel_url):
        """
        Create a Stripe Checkout Session for subscription signup.
        """
        from .customers import CustomerService # Avoid circular import
        if not customer.stripe_customer_id:
            customer = CustomerService.ensure_stripe_customer(customer)

        extra = {
            "user_id": str(customer.user.id),
            "customer_id": str(customer.id),
            "price_id": str(price_id),
        }
        logger.info("Creating Stripe checkout session", extra=extra)

        try:
            checkout_session = stripe.checkout.Session.create(
                customer=customer.stripe_customer_id,
                payment_method_types=['card'],
                line_items = [{
                    "price": price_id,
                    "quantity": 1,
                }],
                mode='subscription',
                success_url=success_url,
                cancel_url=cancel_url,
                allow_promotion_codes=True,
                billing_address_collection='auto',
                metadata = {
                    "customer_id": str(customer.id),
                    "user_id": str(customer.user.id),
                }
            )
            logger.info("Created Stripe checkout session", extra={**extra, "checkout_session_id": checkout_session.id})
            return checkout_session

        except stripe.error.StripeError as e:
            logger.exception("Failed to create Stripe checkout session", extra=extra)
            sentry_sdk.capture_exception(e)
            raise
        except Exception as e:
            logger.exception("Unexpected error while creating Stripe checkout session", extra=extra)
            if not isinstance(e, (ValueError, DjangoValidationError, DRFValidationError)):
                sentry_sdk.capture_exception(e)
            raise

    @staticmethod
    def create_billing_portal_session(customer, return_url):
        """
        Create a Stripe Billing Portal session for managing subscriptions.
        """
        if not customer.stripe_customer_id:
            raise ValueError("Customer must have a Stripe customer ID to access billing portal")

        extra = {
            "user_id": str(customer.user.id),
            "customer_id": str(customer.id),
        }
        logger.info("Creating Stripe billing portal session", extra=extra)

        try:
            portal_session = stripe.billing_portal.Session.create(
                customer=customer.stripe_customer_id,
                return_url=return_url,
            )

            logger.info("Created Stripe billing portal session", extra={**extra, "portal_session_id": portal_session.id})
            return portal_session

        except stripe.error.StripeError as e:
            logger.exception("Failed to create Stripe billing portal session", extra=extra)
            sentry_sdk.capture_exception(e)
            raise
        except Exception as e:
            logger.exception("Unexpected error while creating Stripe billing portal session", extra=extra)
            if not isinstance(e, (ValueError, DjangoValidationError, DRFValidationError)):
                sentry_sdk.capture_exception(e)
            raise

    @staticmethod
    def get_upcoming_invoice(customer):
        """Get customer's upcoming invoice"""
        if not customer.stripe_customer_id:
            return None

        extra = {
            "user_id": str(customer.user.id),
            "customer_id": str(customer.id),
        }
        logger.info("Getting upcoming invoice from Stripe", extra=extra)

        try:
            upcoming_invoice = stripe.Invoice.create_preview(
                customer=customer.stripe_customer_id,
            )
            return upcoming_invoice

        except stripe.error.StripeError as e:
            logger.exception("Failed to get upcoming invoice from Stripe", extra=extra)
            sentry_sdk.capture_exception(e)
            return None
        except Exception as e:
            logger.exception("Unexpected error while getting upcoming invoice", extra=extra)
            if not isinstance(e, (ValueError, DjangoValidationError, DRFValidationError)):
                sentry_sdk.capture_exception(e)
            return None

    @staticmethod
    def list_invoices(customer, limit=10):
        """List customer's past invoices."""
        if not customer.stripe_customer_id:
            return []

        extra = {
            "user_id": str(customer.user.id),
            "customer_id": str(customer.id),
            "limit": limit,
        }
        logger.info("Listing invoices from Stripe", extra=extra)

        try:
            invoices = stripe.Invoice.list(
                customer=customer.stripe_customer_id,
                limit=limit
            )
            return invoices.data
        except stripe.error.StripeError as e:
            logger.exception("Failed to list invoices from Stripe", extra=extra)
            sentry_sdk.capture_exception(e)
            return []
        except Exception as e:
            logger.exception("Unexpected error while listing invoices", extra=extra)
            if not isinstance(e, (ValueError, DjangoValidationError, DRFValidationError)):
                sentry_sdk.capture_exception(e)
            return []
