"""
Management command to retry failed Stripe webhook events.

Usage:
    python manage.py retry_failed_webhooks
    python manage.py retry_failed_webhooks --days 7
    python manage.py retry_failed_webhooks --event-type customer.subscription.updated
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.main.models import StripeWebhookEvent
from apps.billing.handlers import process_webhook_event


class Command(BaseCommand):
    help = 'Retry failed Stripe webhook events'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Retry webhooks failed within the last N days (default: 30)'
        )
        parser.add_argument(
            '--event-type',
            type=str,
            help='Only retry specific event type (e.g., customer.subscription.updated)'
        )
        parser.add_argument(
            '--max-retries',
            type=int,
            default=3,
            help='Skip webhooks that have been retried more than N times (default: 3)'
        )

    def handle(self, *args, **options):
        days = options['days']
        event_type = options['event_type']
        max_retries = options['max_retries']

        # Build query
        cutoff_date = timezone.now() - timedelta(days=days)
        query = StripeWebhookEvent.objects.filter(
            processing_status=StripeWebhookEvent.ProcessingStatus.FAILED,
            created_at__gte=cutoff_date,
            retry_count__lt=max_retries
        )

        if event_type:
            query = query.filter(event_type=event_type)

        failed_events = query.order_by('created_at')
        total_count = failed_events.count()

        if total_count == 0:
            self.stdout.write(self.style.SUCCESS('No failed webhooks to retry.'))
            return

        self.stdout.write(f'Found {total_count} failed webhook(s) to retry...\n')

        success_count = 0
        still_failing_count = 0

        for webhook_event in failed_events:
            self.stdout.write(
                f'Retrying: {webhook_event.stripe_event_id} '
                f'({webhook_event.event_type}) - '
                f'Attempt #{webhook_event.retry_count + 1}'
            )

            try:
                success, updated_event = process_webhook_event(webhook_event.raw_payload)

                if success:
                    success_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'  ✓ Success: {webhook_event.stripe_event_id}')
                    )
                else:
                    still_failing_count += 1
                    error = updated_event.error_message[:100] if updated_event.error_message else 'Unknown error'
                    self.stdout.write(
                        self.style.ERROR(f'  ✗ Still failing: {webhook_event.stripe_event_id} - {error}')
                    )

            except Exception as e:
                still_failing_count += 1
                self.stdout.write(
                    self.style.ERROR(f'  ✗ Exception: {webhook_event.stripe_event_id} - {str(e)}')
                )

        # Summary
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS(f'Retry Summary:'))
        self.stdout.write(f'  Total attempted: {total_count}')
        self.stdout.write(self.style.SUCCESS(f'  Succeeded: {success_count}'))
        if still_failing_count > 0:
            self.stdout.write(self.style.ERROR(f'  Still failing: {still_failing_count}'))
        self.stdout.write('='*60)
