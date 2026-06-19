"""Admin interface for Stripe webhook management."""
from django.contrib import admin
from apps.billing.models import Customer, Subscription, StripeWebhookEvent


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'tier',
        'subscription_active',
        'stripe_customer_id',
        'sync_status',
        'created_at'
    ]
    list_filter = ['tier', 'subscription_active', 'sync_status', 'created_at']
    search_fields = ['user__email', 'stripe_customer_id']
    readonly_fields = [
        'created_at',
        'updated_at',
        'stripe_data_last_synced',
        'stripe_metadata'
    ]
    fieldsets = (
        ('User Information', {
            'fields': ('user',)
        }),
        ('Subscription', {
            'fields': ('tier', 'subscription_active', 'stripe_customer_id')
        }),
        ('Sync Status', {
            'fields': (
                'sync_status',
                'sync_error_message',
                'stripe_data_last_synced',
                'stripe_metadata'
            )
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = [
        'customer',
        'tier',
        'status',
        'stripe_subscription_id',
        'current_period_end',
        'cancel_at_period_end',
        'created_at'
    ]
    list_filter = [
        'status',
        'tier',
        'cancel_at_period_end',
        'created_at'
    ]
    search_fields = [
        'customer__user__email',
        'stripe_subscription_id',
        'stripe_product_id',
        'stripe_price_id'
    ]
    readonly_fields = [
        'created_at',
        'updated_at',
        'stripe_metadata'
    ]
    fieldsets = (
        ('Customer', {
            'fields': ('customer',)
        }),
        ('Stripe Identifiers', {
            'fields': (
                'stripe_subscription_id',
                'stripe_product_id',
                'stripe_price_id'
            )
        }),
        ('Subscription Details', {
            'fields': (
                'status',
                'tier'
            )
        }),
        ('Billing Cycle', {
            'fields': (
                'current_period_start',
                'current_period_end',
                'trial_start',
                'trial_end'
            )
        }),
        ('Cancellation', {
            'fields': (
                'cancel_at_period_end',
                'canceled_at',
                'ended_at'
            )
        }),
        ('Metadata', {
            'fields': ('stripe_metadata',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(StripeWebhookEvent)
class StripeWebhookEventAdmin(admin.ModelAdmin):
    list_display = [
        'stripe_event_id',
        'event_type',
        'processing_status',
        'retry_count',
        'created_at',
        'processing_completed_at'
    ]
    list_filter = [
        'processing_status',
        'event_type',
        'created_at'
    ]
    search_fields = [
        'stripe_event_id',
        'event_type',
        'related_customer__user__email',
        'related_subscription__stripe_subscription_id'
    ]
    readonly_fields = [
        'stripe_event_id',
        'event_type',
        'raw_payload',
        'created_at',
        'updated_at',
        'processing_started_at',
        'processing_completed_at',
        'last_retry_at'
    ]
    actions = ['retry_failed_webhooks']

    fieldsets = (
        ('Event Information', {
            'fields': (
                'stripe_event_id',
                'event_type',
                'related_customer',
                'related_subscription'
            )
        }),
        ('Processing Status', {
            'fields': (
                'processing_status',
                'processing_started_at',
                'processing_completed_at',
                'error_message'
            )
        }),
        ('Retry Information', {
            'fields': (
                'retry_count',
                'last_retry_at'
            )
        }),
        ('Payload', {
            'fields': ('raw_payload',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    def retry_failed_webhooks(self, request, queryset):
        """Admin action to retry failed webhook processing."""
        from .handlers import process_webhook_event
        from django.contrib import messages

        failed_events = queryset.filter(
            processing_status=StripeWebhookEvent.ProcessingStatus.FAILED
        )

        success_count = 0
        for webhook_event in failed_events:
            try:
                success, _ = process_webhook_event(webhook_event.raw_payload)
                if success:
                    success_count += 1
            except Exception as e:
                pass

        self.message_user(
            request,
            f"Retried {failed_events.count()} failed webhooks. {success_count} succeeded.",
            messages.SUCCESS if success_count > 0 else messages.WARNING
        )

    retry_failed_webhooks.short_description = "Retry selected failed webhooks"
