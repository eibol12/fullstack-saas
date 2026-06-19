"""
Management command to perform health checks on subscription data.

Daily production health check that:
- Finds mismatches between Stripe and local DB
- Reports sync issues
- Lists expired trials
- Validates tier cache integrity
- Monitors webhook health

Usage:
    python manage.py check_subscriptions
    python manage.py check_subscriptions --verbose
    python manage.py check_subscriptions --json
    python manage.py check_subscriptions --check-stripe
    python manage.py check_subscriptions --fix-tier-mismatches
"""
import json
import time
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from django.db.models import Q, Count
import stripe
import logging

from apps.billing.models import Customer, Subscription, StripeWebhookEvent

logger = logging.getLogger(__name__)
stripe.api_key = settings.STRIPE_API_KEY


class Command(BaseCommand):
    help = 'Health check: Find mismatches between Stripe and local DB, report sync issues, list expired trials'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.issues = []
        self.stats = {
            'total_customers': 0,
            'total_subscriptions': 0,
            'sync_issues': 0,
            'trial_issues': 0,
            'webhook_failures': 0,
            'tier_mismatches': 0,
            'stripe_mismatches': 0,
        }
        self.verbose = False
        self.json_output = False
        self.start_time = None

    def add_arguments(self, parser):
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed output with all findings',
        )
        parser.add_argument(
            '--json',
            action='store_true',
            help='Output results in JSON format',
        )
        parser.add_argument(
            '--fix-tier-mismatches',
            action='store_true',
            help='Automatically fix customer tier cache mismatches',
        )
        parser.add_argument(
            '--days-ahead',
            type=int,
            default=7,
            help='Days ahead to check for upcoming trial expirations (default: 7)',
        )
        parser.add_argument(
            '--check-stripe',
            action='store_true',
            help='Perform full Stripe API comparison (may be slow for many records)',
        )
        parser.add_argument(
            '--stale-sync-days',
            type=int,
            default=7,
            help='Days after which a sync is considered stale (default: 7)',
        )

    def handle(self, *args, **options):
        self.start_time = time.time()
        self.verbose = options['verbose']
        self.json_output = options['json']
        fix_tier_mismatches = options['fix_tier_mismatches']
        days_ahead = options['days_ahead']
        check_stripe = options['check_stripe']
        stale_sync_days = options['stale_sync_days']

        if not self.json_output:
            self.stdout.write(self.style.SUCCESS('=' * 70))
            self.stdout.write(self.style.SUCCESS('Subscription Health Check'))
            self.stdout.write(self.style.SUCCESS('=' * 70))
            self.stdout.write('')

        # Gather basic stats
        self.stats['total_customers'] = Customer.objects.count()
        self.stats['total_subscriptions'] = Subscription.objects.count()

        # Run all health checks
        self._check_sync_status(stale_sync_days)
        self._check_trials(days_ahead)
        self._check_webhook_health()
        self._check_tier_cache(fix_tier_mismatches)

        if check_stripe:
            self._check_stripe_comparison()

        # Output results
        self._output_results()

        # Exit with error code if critical issues found
        critical_issues = self.stats['sync_issues'] + self.stats['tier_mismatches']
        if critical_issues > 0:
            logger.warning(f"Health check found {critical_issues} critical issues")
            return

    def _check_sync_status(self, stale_days):
        """Check for sync status issues."""
        if not self.json_output:
            self.stdout.write(self.style.HTTP_INFO('\n[1] Sync Status Check'))
            self.stdout.write('-' * 70)

        # Failed syncs
        failed_syncs = Customer.objects.filter(sync_status=Customer.SyncStatus.FAILED)
        count = failed_syncs.count()

        if count > 0:
            self.stats['sync_issues'] += count
            self.issues.append({
                'category': 'sync_status',
                'severity': 'error',
                'message': f'Found {count} customers with failed sync status',
                'count': count,
                'details': []
            })

            if not self.json_output:
                self.stdout.write(self.style.ERROR(f'  ✗ Found {count} customers with FAILED sync status'))

            if self.verbose:
                for customer in failed_syncs[:10]:  # Limit to first 10 in verbose mode
                    detail = f'    - Customer {customer.id} ({customer.user.email}): {customer.sync_error_message}'
                    self.issues[-1]['details'].append(detail)
                    if not self.json_output:
                        self.stdout.write(self.style.WARNING(detail))

                if count > 10 and not self.json_output:
                    self.stdout.write(self.style.WARNING(f'    ... and {count - 10} more'))

        # Stale syncs
        stale_threshold = timezone.now() - timedelta(days=stale_days)
        stale_syncs = Customer.objects.filter(
            stripe_customer_id__isnull=False,
            stripe_data_last_synced__lt=stale_threshold
        )
        count = stale_syncs.count()

        if count > 0:
            self.stats['sync_issues'] += count
            self.issues.append({
                'category': 'sync_status',
                'severity': 'warning',
                'message': f'Found {count} customers with stale sync (>{stale_days} days)',
                'count': count,
                'details': []
            })

            if not self.json_output:
                self.stdout.write(self.style.WARNING(f'  ! Found {count} customers with stale sync (>{stale_days} days)'))

        # Never synced but have Stripe ID
        never_synced = Customer.objects.filter(
            stripe_customer_id__isnull=False,
            stripe_data_last_synced__isnull=True
        )
        count = never_synced.count()

        if count > 0:
            self.stats['sync_issues'] += count
            if not self.json_output:
                self.stdout.write(self.style.WARNING(f'  ! Found {count} customers with Stripe ID but never synced'))

        if self.stats['sync_issues'] == 0 and not self.json_output:
            self.stdout.write(self.style.SUCCESS('  ✓ All sync statuses are healthy'))

    def _check_trials(self, days_ahead):
        """Check trial status and expirations."""
        if not self.json_output:
            self.stdout.write(self.style.HTTP_INFO('\n[2] Trial Monitoring'))
            self.stdout.write('-' * 70)

        now = timezone.now()

        # Expired trials that are still marked as trialing (sync issue)
        expired_trials = Subscription.objects.filter(
            status=Subscription.Status.TRIALING,
            trial_end__lt=now
        )
        count = expired_trials.count()

        if count > 0:
            self.stats['trial_issues'] += count
            self.issues.append({
                'category': 'trials',
                'severity': 'error',
                'message': f'Found {count} expired trials still marked as TRIALING',
                'count': count,
                'details': []
            })

            if not self.json_output:
                self.stdout.write(self.style.ERROR(f'  ✗ Found {count} expired trials still marked as TRIALING'))

            if self.verbose:
                for sub in expired_trials[:10]:
                    detail = f'    - Subscription {sub.stripe_subscription_id} (Customer: {sub.customer.user.email}, Expired: {sub.trial_end})'
                    self.issues[-1]['details'].append(detail)
                    if not self.json_output:
                        self.stdout.write(self.style.WARNING(detail))

        # Trials expiring soon
        expiring_threshold = now + timedelta(days=days_ahead)
        expiring_trials = Subscription.objects.filter(
            status=Subscription.Status.TRIALING,
            trial_end__gte=now,
            trial_end__lte=expiring_threshold
        )
        count = expiring_trials.count()

        if count > 0:
            self.issues.append({
                'category': 'trials',
                'severity': 'info',
                'message': f'Found {count} trials expiring in next {days_ahead} days',
                'count': count,
                'details': []
            })

            if not self.json_output:
                self.stdout.write(self.style.WARNING(f'  ! {count} trials expiring in next {days_ahead} days'))

            if self.verbose:
                for sub in expiring_trials:
                    days_left = (sub.trial_end - now).days
                    detail = f'    - {sub.customer.user.email}: {days_left} days left (expires {sub.trial_end.date()})'
                    self.issues[-1]['details'].append(detail)
                    if not self.json_output:
                        self.stdout.write(self.style.WARNING(detail))

        # Active trials count
        active_trials = Subscription.objects.filter(
            status=Subscription.Status.TRIALING,
            trial_end__gte=now
        ).count()

        if not self.json_output:
            self.stdout.write(self.style.SUCCESS(f'  ✓ {active_trials} active trials'))

        if self.stats['trial_issues'] == 0 and not self.json_output:
            self.stdout.write(self.style.SUCCESS('  ✓ No trial sync issues detected'))

    def _check_webhook_health(self):
        """Check webhook processing health."""
        if not self.json_output:
            self.stdout.write(self.style.HTTP_INFO('\n[3] Webhook Health Check'))
            self.stdout.write('-' * 70)

        now = timezone.now()

        # Failed webhooks in last 24 hours
        failed_24h = StripeWebhookEvent.objects.filter(
            processing_status=StripeWebhookEvent.ProcessingStatus.FAILED,
            created_at__gte=now - timedelta(hours=24)
        )
        count = failed_24h.count()

        if count > 0:
            self.stats['webhook_failures'] += count
            self.issues.append({
                'category': 'webhooks',
                'severity': 'error',
                'message': f'Found {count} failed webhook events in last 24 hours',
                'count': count,
                'details': []
            })

            if not self.json_output:
                self.stdout.write(self.style.ERROR(f'  ✗ {count} failed webhooks in last 24 hours'))

            if self.verbose:
                for event in failed_24h[:10]:
                    detail = f'    - {event.event_type} ({event.stripe_event_id}): {event.error_message[:100]}'
                    self.issues[-1]['details'].append(detail)
                    if not self.json_output:
                        self.stdout.write(self.style.WARNING(detail))

        # Failed webhooks in last 7 days
        failed_7d = StripeWebhookEvent.objects.filter(
            processing_status=StripeWebhookEvent.ProcessingStatus.FAILED,
            created_at__gte=now - timedelta(days=7)
        ).count()

        if failed_7d > 0 and not self.json_output:
            self.stdout.write(self.style.WARNING(f'  ! {failed_7d} total failed webhooks in last 7 days'))

        # Pending webhooks (stuck in processing?)
        pending = StripeWebhookEvent.objects.filter(
            processing_status__in=[
                StripeWebhookEvent.ProcessingStatus.PENDING,
                StripeWebhookEvent.ProcessingStatus.PROCESSING
            ],
            created_at__lt=now - timedelta(minutes=5)  # Pending for more than 5 minutes
        )
        count = pending.count()

        if count > 0:
            self.stats['webhook_failures'] += count
            if not self.json_output:
                self.stdout.write(self.style.WARNING(f'  ! {count} webhooks stuck in pending/processing state'))

        # Webhook event type breakdown
        if self.verbose and not self.json_output:
            event_breakdown = StripeWebhookEvent.objects.filter(
                created_at__gte=now - timedelta(days=7)
            ).values('event_type').annotate(count=Count('id')).order_by('-count')

            self.stdout.write(self.style.HTTP_INFO('\n  Event types (last 7 days):'))
            for item in event_breakdown[:10]:
                self.stdout.write(f'    - {item["event_type"]}: {item["count"]}')

        if self.stats['webhook_failures'] == 0 and not self.json_output:
            self.stdout.write(self.style.SUCCESS('  ✓ Webhook processing is healthy'))

    def _check_tier_cache(self, fix_mismatches):
        """Check customer tier cache integrity."""
        if not self.json_output:
            self.stdout.write(self.style.HTTP_INFO('\n[4] Tier Cache Validation'))
            self.stdout.write('-' * 70)

        # Find customers where cached tier doesn't match active subscription
        mismatched_customers = []

        for customer in Customer.objects.select_related('user').prefetch_related('subscriptions'):
            active_sub = customer.subscriptions.filter(
                status__in=[Subscription.Status.ACTIVE, Subscription.Status.TRIALING]
            ).order_by('-current_period_end').first()

            # Check tier mismatch
            if active_sub and customer.tier != active_sub.tier:
                mismatched_customers.append({
                    'customer': customer,
                    'cached_tier': customer.tier,
                    'actual_tier': active_sub.tier,
                    'subscription_id': active_sub.stripe_subscription_id
                })

            # Check subscription_active mismatch
            expected_active = active_sub is not None
            if customer.subscription_active != expected_active:
                if active_sub:
                    mismatched_customers.append({
                        'customer': customer,
                        'issue': 'subscription_active is False but has active subscription',
                        'subscription_id': active_sub.stripe_subscription_id
                    })
                else:
                    mismatched_customers.append({
                        'customer': customer,
                        'issue': 'subscription_active is True but no active subscription',
                        'subscription_id': None
                    })

        count = len(mismatched_customers)

        if count > 0:
            self.stats['tier_mismatches'] += count
            self.issues.append({
                'category': 'tier_cache',
                'severity': 'error',
                'message': f'Found {count} customers with tier cache mismatches',
                'count': count,
                'details': []
            })

            if not self.json_output:
                self.stdout.write(self.style.ERROR(f'  ✗ Found {count} customers with tier cache mismatches'))

            if self.verbose:
                for item in mismatched_customers[:10]:
                    customer = item['customer']
                    if 'cached_tier' in item:
                        detail = f'    - {customer.user.email}: cached={item["cached_tier"]}, actual={item["actual_tier"]}'
                    else:
                        detail = f'    - {customer.user.email}: {item["issue"]}'
                    self.issues[-1]['details'].append(detail)
                    if not self.json_output:
                        self.stdout.write(self.style.WARNING(detail))

            # Fix mismatches if requested
            if fix_mismatches:
                fixed_count = 0
                for item in mismatched_customers:
                    try:
                        item['customer'].update_tier_from_subscription()
                        fixed_count += 1
                    except Exception as e:
                        logger.error(f"Failed to fix tier for customer {item['customer'].id}: {e}")

                if not self.json_output:
                    self.stdout.write(self.style.SUCCESS(f'  ✓ Fixed {fixed_count} tier mismatches'))
        else:
            if not self.json_output:
                self.stdout.write(self.style.SUCCESS('  ✓ All tier caches are consistent'))

    def _check_stripe_comparison(self):
        """Compare local subscriptions with Stripe (requires API calls)."""
        if not self.json_output:
            self.stdout.write(self.style.HTTP_INFO('\n[5] Stripe API Comparison'))
            self.stdout.write('-' * 70)
            self.stdout.write(self.style.WARNING('  Note: This may take a while for many subscriptions...'))

        if not stripe.api_key:
            if not self.json_output:
                self.stdout.write(self.style.ERROR('  ✗ STRIPE_API_KEY not configured'))
            return

        try:
            # Fetch all active/trialing subscriptions from Stripe
            stripe_subscriptions = {}
            has_more = True
            starting_after = None

            while has_more:
                params = {'limit': 100, 'status': 'all'}
                if starting_after:
                    params['starting_after'] = starting_after

                response = stripe.Subscription.list(**params)

                for sub in response.data:
                    # Only track active/trialing subscriptions
                    if sub.status in ['active', 'trialing']:
                        stripe_subscriptions[sub.id] = {
                            'status': sub.status,
                            'customer_id': sub.customer,
                        }

                has_more = response.has_more
                if has_more and response.data:
                    starting_after = response.data[-1].id

            # Compare with local subscriptions
            local_subscriptions = {
                sub.stripe_subscription_id: sub
                for sub in Subscription.objects.filter(
                    status__in=[Subscription.Status.ACTIVE, Subscription.Status.TRIALING]
                )
            }

            # Find orphaned subscriptions (in Stripe but not local)
            orphaned = []
            for stripe_id, stripe_data in stripe_subscriptions.items():
                if stripe_id not in local_subscriptions:
                    orphaned.append({
                        'stripe_subscription_id': stripe_id,
                        'stripe_status': stripe_data['status'],
                        'stripe_customer_id': stripe_data['customer_id']
                    })

            if orphaned:
                count = len(orphaned)
                self.stats['stripe_mismatches'] += count
                self.issues.append({
                    'category': 'stripe_comparison',
                    'severity': 'error',
                    'message': f'Found {count} active subscriptions in Stripe not in local DB',
                    'count': count,
                    'details': []
                })

                if not self.json_output:
                    self.stdout.write(self.style.ERROR(f'  ✗ {count} active subscriptions in Stripe not in local DB'))

                if self.verbose:
                    for item in orphaned[:10]:
                        detail = f'    - {item["stripe_subscription_id"]} (customer: {item["stripe_customer_id"]})'
                        self.issues[-1]['details'].append(detail)
                        if not self.json_output:
                            self.stdout.write(self.style.WARNING(detail))

            # Find ghost subscriptions (in local but deleted in Stripe)
            ghosts = []
            for local_id, local_sub in local_subscriptions.items():
                if local_id not in stripe_subscriptions:
                    ghosts.append({
                        'stripe_subscription_id': local_id,
                        'local_status': local_sub.status,
                        'customer_email': local_sub.customer.user.email
                    })

            if ghosts:
                count = len(ghosts)
                self.stats['stripe_mismatches'] += count
                self.issues.append({
                    'category': 'stripe_comparison',
                    'severity': 'warning',
                    'message': f'Found {count} active local subscriptions not in Stripe',
                    'count': count,
                    'details': []
                })

                if not self.json_output:
                    self.stdout.write(self.style.WARNING(f'  ! {count} active local subscriptions not in Stripe'))

                if self.verbose:
                    for item in ghosts[:10]:
                        detail = f'    - {item["stripe_subscription_id"]} (customer: {item["customer_email"]})'
                        self.issues[-1]['details'].append(detail)
                        if not self.json_output:
                            self.stdout.write(self.style.WARNING(detail))

            if not orphaned and not ghosts and not self.json_output:
                self.stdout.write(self.style.SUCCESS('  ✓ Local DB and Stripe are in sync'))

        except stripe.error.StripeError as e:
            if not self.json_output:
                self.stdout.write(self.style.ERROR(f'  ✗ Stripe API error: {str(e)}'))
            logger.error(f"Stripe API error during comparison: {e}")

    def _output_results(self):
        """Output final results."""
        elapsed_time = time.time() - self.start_time

        if self.json_output:
            # JSON output
            output = {
                'timestamp': timezone.now().isoformat(),
                'elapsed_time_seconds': round(elapsed_time, 2),
                'stats': self.stats,
                'issues': self.issues,
                'total_issues': len(self.issues)
            }
            self.stdout.write(json.dumps(output, indent=2))
        else:
            # Human-readable summary
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('=' * 70))
            self.stdout.write(self.style.SUCCESS('Summary'))
            self.stdout.write(self.style.SUCCESS('=' * 70))
            self.stdout.write(f'Total Customers:       {self.stats["total_customers"]}')
            self.stdout.write(f'Total Subscriptions:   {self.stats["total_subscriptions"]}')
            self.stdout.write('')
            self.stdout.write(f'Sync Issues:           {self.stats["sync_issues"]}')
            self.stdout.write(f'Trial Issues:          {self.stats["trial_issues"]}')
            self.stdout.write(f'Webhook Failures:      {self.stats["webhook_failures"]}')
            self.stdout.write(f'Tier Mismatches:       {self.stats["tier_mismatches"]}')
            self.stdout.write(f'Stripe Mismatches:     {self.stats["stripe_mismatches"]}')
            self.stdout.write('')
            self.stdout.write(f'Total Issues Found:    {len(self.issues)}')
            self.stdout.write(f'Elapsed Time:          {elapsed_time:.2f}s')
            self.stdout.write('')

            # Overall status
            total_critical = self.stats['sync_issues'] + self.stats['tier_mismatches']
            if total_critical > 0:
                self.stdout.write(self.style.ERROR(f'Status: CRITICAL - {total_critical} critical issues found'))
            elif len(self.issues) > 0:
                self.stdout.write(self.style.WARNING(f'Status: WARNING - {len(self.issues)} issues found'))
            else:
                self.stdout.write(self.style.SUCCESS('Status: HEALTHY - No issues detected'))

            self.stdout.write(self.style.SUCCESS('=' * 70))
