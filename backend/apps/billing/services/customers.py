import logging
from django.db import transaction
from apps.billing.models import Customer
from .stripe import StripeService

logger = logging.getLogger(__name__)

class CustomerService:
    """
    Service class for managing billing operations with Stripe.
    """
    @staticmethod
    @transaction.atomic
    def create_customer(user, ensure_stripe=False):
        """
        Ensure a local Customer exists for the given user.
        """
        user_id = str(user.id) if hasattr(user, "id") else None
        logger.info(
            "Creating or retrieving local customer record",
            extra={
                "user_id": user_id,
                "ensure_stripe": ensure_stripe,
            }
        )

        customer, created = Customer.objects.get_or_create(
            user=user,
            defaults={
                "tier": Customer.Tier.FREE,
                "subscription_active": False,
                "sync_status": Customer.SyncStatus.SYNCED,
                "sync_error_message": "",
                "stripe_metadata": {},
            }
        )

        if created:
            logger.info(
                "Created new local customer record",
                extra={
                    "user_id": user_id,
                    "customer_id": str(customer.id),
                    "tier": customer.tier,
                }
            )
        else:
            logger.info(
                "Retrieved existing local customer record",
                extra={
                    "user_id": user_id,
                    "customer_id": str(customer.id),
                    "tier": customer.tier,
                }
            )

        if ensure_stripe:
            customer = CustomerService.ensure_stripe_customer(customer)

        return customer

    @staticmethod
    def ensure_stripe_customer(customer):
        """
        Ensure the local customer is linked to a Stripe Customer
        """
        user_id = str(customer.user.id) if customer.user and hasattr(customer.user, "id") else None
        customer_id = str(customer.id)

        if customer.stripe_customer_id:
            logger.debug(
                "Stripe customer ID already present, skipping Stripe creation",
                extra={
                    "user_id": user_id,
                    "customer_id": customer_id,
                    "stripe_customer_id": customer.stripe_customer_id,
                }
            )
            return customer

        logger.info(
            "Stripe customer ID missing; initiating creation via StripeService",
            extra={
                "user_id": user_id,
                "customer_id": customer_id,
            }
        )
        return StripeService.create_customer(customer)
