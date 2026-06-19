from django.contrib.auth import get_user_model
from django.db import models
from apps.main.models import TimestampedModel
from django.dispatch import receiver
from django.contrib.contenttypes.fields import GenericForeignKey
import uuid


User = get_user_model()


class Customer(TimestampedModel):

    class Tier(models.TextChoices):
        FREE = "free", "Free"
        STARTER = "starter", "Starter"
        PRO = "pro", "Pro"

    class SyncStatus(models.TextChoices):
        SYNCED = "synced", "Synced"
        PENDING = "pending", "Pending"
        FAILED = "failed", "Failed"

    """Model representing a customer for the SaaS platform."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='customer')

    # Stripe/SaaS fieldstgy;
    tier = models.CharField(
        max_length=20,
        choices=Tier.choices,
        default=Tier.FREE,
        help_text="Cached customer subscription tier for fast queries. Source of truth is Subscription model."
    )
    stripe_customer_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        unique=True,
        help_text="Stripe customer identifier."
    )
    subscription_active = models.BooleanField(
        default=False,
        help_text="Whether the customer has an active paid subscription. Cached from Subscription model."
    )

    # Webhook sync tracking
    stripe_data_last_synced = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of last successful sync with Stripe."
    )
    sync_status = models.CharField(
        max_length=20,
        choices=SyncStatus.choices,
        default=SyncStatus.SYNCED,
        help_text="Status of last Stripe data synchronization."
    )
    sync_error_message = models.TextField(
        blank=True,
        help_text="Error message from last failed sync attempt."
    )

    # Flexible metadata storage
    stripe_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional Stripe customer data for flexibility."
    )

    def __str__(self):
        return f"Customer: {self.user.email} ({self.tier})"

    def update_tier_from_subscription(self):
        """Update cached tier based on active subscription. Called by webhook handlers."""
        active_subscription = self.subscriptions.filter(
            status__in=['active', 'trialing']
        ).order_by('-current_period_end').first()

        if active_subscription:
            self.tier = active_subscription.tier
            self.subscription_active = True
        else:
            self.tier = self.Tier.FREE
            self.subscription_active = False

        self.save(update_fields=['tier', 'subscription_active'])

    class Meta:
        indexes = [
            models.Index(fields=['stripe_customer_id']),
            models.Index(fields=['tier', 'subscription_active']),
        ]


class Subscription(TimestampedModel):
    """
    Model representing a customer's subscription in Stripe.
    Source of truth for subscription state and tier.
    """
    class Status(models.TextChoices):
        INCOMPLETE = "incomplete", "Incomplete"
        INCOMPLETE_EXPIRED = "incomplete_expired", "Incomplete Expired"
        TRIALING = "trialing", "Trialing"
        ACTIVE = "active", "Active"
        PAST_DUE = "past_due", "Past Due"
        CANCELED = "canceled", "Canceled"
        UNPAID = "unpaid", "Unpaid"
        PAUSED = "paused", "Paused"

    # Relationships
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='subscriptions',
        help_text="Customer who owns this subscription."
    )

    # Stripe identifiers
    stripe_subscription_id = models.CharField(
        max_length=100,
        unique=True,
        help_text="Stripe subscription ID (e.g., sub_xxxxx)."
    )
    stripe_product_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Stripe product ID (e.g., prod_xxxxx)."
    )
    stripe_price_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Stripe price ID (e.g., price_xxxxx)."
    )

    # Subscription state
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.INCOMPLETE,
        help_text="Current subscription status from Stripe."
    )
    tier = models.CharField(
        max_length=20,
        choices=Customer.Tier.choices,
        default=Customer.Tier.FREE,
        help_text="Subscription tier (maps from Stripe product metadata)."
    )

    # Billing cycle
    current_period_start = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Start of current billing period."
    )
    current_period_end = models.DateTimeField(
        null=True,
        blank=True,
        help_text="End of current billing period."
    )
    trial_start = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Trial start date."
    )
    trial_end = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Trial end date."
    )
    canceled_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when subscription was canceled."
    )
    cancel_at_period_end = models.BooleanField(
        default=False,
        help_text="If true, subscription will cancel at end of current period."
    )
    ended_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when subscription ended."
    )

    # Metadata
    stripe_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional Stripe subscription metadata."
    )

    def __str__(self):
        return f"Subscription {self.stripe_subscription_id} - {self.customer.user.email} ({self.tier} - {self.status})"

    def is_active(self):
        """Check if subscription provides active service."""
        return self.status in [self.Status.ACTIVE, self.Status.TRIALING]

    def save(self, *args, **kwargs):
        """Override save to update customer's cached tier."""
        super().save(*args, **kwargs)
        # Update customer's cached tier after saving subscription
        self.customer.update_tier_from_subscription()

    class Meta:
        indexes = [
            models.Index(fields=['stripe_subscription_id']),
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['status', 'current_period_end']),
        ]
        ordering = ['-current_period_end']


class StripeWebhookEvent(TimestampedModel):
    """
    Model for tracking Stripe webhook events to ensure idempotent processing.
    Prevents duplicate processing and enables debugging/replay.
    """
    class ProcessingStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"

    # Stripe webhook identifiers
    stripe_event_id = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Stripe event ID (e.g., evt_xxxxx) for idempotency."
    )
    event_type = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Stripe event type (e.g., customer.subscription.updated)."
    )

    # Processing state
    processing_status = models.CharField(
        max_length=20,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.PENDING,
        help_text="Current processing status of this webhook."
    )
    processing_started_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When processing started."
    )
    processing_completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When processing completed (success or failure)."
    )

    # Error tracking
    error_message = models.TextField(
        blank=True,
        help_text="Error message if processing failed."
    )
    retry_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of retry attempts."
    )
    last_retry_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of last retry attempt."
    )

    # Payload storage (for debugging and replay)
    raw_payload = models.JSONField(
        help_text="Raw webhook payload from Stripe for debugging/replay."
    )

    # Related objects (optional, for easier querying)
    related_customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='webhook_events',
        help_text="Related customer if applicable."
    )
    related_subscription = models.ForeignKey(
        Subscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='webhook_events',
        help_text="Related subscription if applicable."
    )

    def __str__(self):
        return f"Webhook {self.stripe_event_id} - {self.event_type} ({self.processing_status})"

    class Meta:
        indexes = [
            models.Index(fields=['stripe_event_id']),
            models.Index(fields=['event_type', 'processing_status']),
            models.Index(fields=['processing_status', 'created_at']),
        ]
        ordering = ['-created_at']
        verbose_name = "Stripe Webhook Event"
        verbose_name_plural = "Stripe Webhook Events"

