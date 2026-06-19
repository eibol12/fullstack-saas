"""
Management command to sync data from Stripe to local database.

IMPORTANT: This is a MANUAL RECOVERY TOOL and SAFETY NET, not the primary sync mechanism.
Primary sync happens via webhooks. Use this command for:
- Manual recovery after webhook failures
- Emergency reconciliation
- Fixing specific customer/subscription issues
- Weekly/monthly safety backstop

Usage:
    # DRY RUN (default - shows what would change without applying)
    python manage.py sync_stripe_data
    python manage.py sync_stripe_data --customer-id cus_xxxxx

    # ACTUALLY APPLY CHANGES (requires --apply flag)
    python manage.py sync_stripe_data --apply
    python manage.py sync_stripe_data --customer-id cus_xxxxx --apply
    python manage.py sync_stripe_data --subscription-id sub_xxxxx --apply
    python manage.py sync_stripe_data --failed-only --apply

    # VERBOSE OUTPUT
    python manage.py sync_stripe_data --verbose --apply

DO NOT use this as your primary sync mechanism - that indicates webhook handling is broken.
"""
import json
import time
from datetime import datetime, timezone as datetime_timezone, timedelta
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from django.db import transaction
import stripe
import logging

from apps.billing.models import Customer, Subscription
from apps.billing.handlers import SubscriptionCreatedHandler

logger = logging.getLogger(__name__)
stripe.api_key = settings.STRIPE_API_KEY


class Command(BaseCommand):
    help = 'Sync customers and subscriptions from Stripe (manual recovery tool - NOT primary sync)'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.dry_run = True
        self.verbose = False
        self.json_output = False
        self.changes = []
        self.errors = []
        self.stats = {
            'customers_processed': 0,
            'customers_updated': 0,
            'customers_no_change': 0,
            'customers_created': 0,
            'customers_errors': 0,
            'subscriptions_processed': 0,
            'subscriptions_updated': 0,
            'subscriptions_created': 0,
            'subscriptions_no_change': 0,
            'subscriptions_errors': 0,
        }
        self.start_time = None

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Actually apply changes (default is dry-run mode)',
        )
        parser.add_argument(
            '--customer-id',
            type=str,
            help='Sync specific Stripe customer ID (e.g., cus_xxxxx)',
        )
        parser.add_argument(
            '--subscription-id',
            type=str,
            help='Sync specific Stripe subscription ID (e.g., sub_xxxxx)',
        )
        parser.add_argument(
            '--failed-only',
            action='store_true',
            help='Only sync customers with sync_status=FAILED',
        )
        parser.add_argument(
            '--stale-days',
            type=int,
            help='Sync customers not synced in X days',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed output with all changes',
        )
        parser.add_argument(
            '--json',
            action='store_true',
            help='Output results in JSON format',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            help='Limit number of records to process',
        )

    def handle(self, *args, **options):
        self.start_time = time.time()
        self.dry_run = not options['apply']
        self.verbose = options['verbose']
        self.json_output = options['json']

        customer_id = options.get('customer_id')
        subscription_id = options.get('subscription_id')
        failed_only = options.get('failed_only')
        stale_days = options.get('stale_days')
        batch_size = options.get('batch_size')

        if not stripe.api_key:
            self.stdout.write(self.style.ERROR('STRIPE_API_KEY not configured'))
            return

        # Display header
        if not self.json_output:
            self.stdout.write(self.style.SUCCESS('=' * 70))
            if self.dry_run:
                self.stdout.write(self.style.WARNING('Stripe Data Sync - DRY RUN MODE'))
                self.stdout.write(self.style.WARNING('No changes will be made. Use --apply to actually sync.'))
            else:
                self.stdout.write(self.style.SUCCESS('Stripe Data Sync - APPLYING CHANGES'))
            self.stdout.write(self.style.SUCCESS('=' * 70))
            self.stdout.write('')

        # Route to appropriate sync operation
        if subscription_id:
            self._sync_single_subscription(subscription_id)
        elif customer_id:
            self._sync_single_customer(customer_id)
        elif failed_only:
            self._sync_failed_customers()
        elif stale_days:
            self._sync_stale_customers(stale_days, batch_size)
        else:
            # Full sync - all customers and subscriptions
            self._sync_all_data(batch_size)

        # Output results
        self._output_results()

    def _sync_single_customer(self, stripe_customer_id):
        """Sync a single customer by Stripe customer ID."""
        if not self.json_output:
            self.stdout.write(self.style.HTTP_INFO(f'\n[1] Syncing Customer: {stripe_customer_id}'))
            self.stdout.write('-' * 70)

        try:
            self._sync_customer(stripe_customer_id)
        except Exception as e:
            self.errors.append({
                'type': 'customer',
                'id': stripe_customer_id,
                'error': str(e)
            })
            if not self.json_output:
                self.stdout.write(self.style.ERROR(f'  ✗ Error: {str(e)}'))

    def _sync_single_subscription(self, stripe_subscription_id):
        """Sync a single subscription by Stripe subscription ID."""
        if not self.json_output:
            self.stdout.write(self.style.HTTP_INFO(f'\n[1] Syncing Subscription: {stripe_subscription_id}'))
            self.stdout.write('-' * 70)

        try:
            self._sync_subscription(stripe_subscription_id)
        except Exception as e:
            self.errors.append({
                'type': 'subscription',
                'id': stripe_subscription_id,
                'error': str(e)
            })
            if not self.json_output:
                self.stdout.write(self.style.ERROR(f'  ✗ Error: {str(e)}'))

    def _sync_failed_customers(self):
        """Sync only customers with failed sync status."""
        if not self.json_output:
            self.stdout.write(self.style.HTTP_INFO('\n[1] Syncing Failed Customers'))
            self.stdout.write('-' * 70)

        failed_customers = Customer.objects.filter(
            sync_status=Customer.SyncStatus.FAILED,
            stripe_customer_id__isnull=False
        )
        total = failed_customers.count()

        if total == 0:
            if not self.json_output:
                self.stdout.write(self.style.SUCCESS('  ✓ No failed customers to sync'))
            return

        if not self.json_output:
            self.stdout.write(f'  Found {total} failed customers to sync')

        for i, customer in enumerate(failed_customers, 1):
            if not self.json_output and self.verbose:
                self.stdout.write(f'\n  [{i}/{total}] Customer {customer.stripe_customer_id} ({customer.user.email})')

            try:
                self._sync_customer(customer.stripe_customer_id)
            except Exception as e:
                self.errors.append({
                    'type': 'customer',
                    'id': customer.stripe_customer_id,
                    'error': str(e)
                })
                if not self.json_output:
                    self.stdout.write(self.style.ERROR(f'    ✗ Error: {str(e)}'))

    def _sync_stale_customers(self, stale_days, batch_size=None):
        """Sync customers not synced in X days."""
        if not self.json_output:
            self.stdout.write(self.style.HTTP_INFO(f'\n[1] Syncing Stale Customers (>{stale_days} days)'))
            self.stdout.write('-' * 70)

        stale_threshold = timezone.now() - timedelta(days=stale_days)
        stale_customers = Customer.objects.filter(
            stripe_customer_id__isnull=False,
            stripe_data_last_synced__lt=stale_threshold
        )

        if batch_size:
            stale_customers = stale_customers[:batch_size]

        total = stale_customers.count()

        if total == 0:
            if not self.json_output:
                self.stdout.write(self.style.SUCCESS(f'  ✓ No stale customers (>{stale_days} days)'))
            return

        if not self.json_output:
            self.stdout.write(f'  Found {total} stale customers to sync')

        for i, customer in enumerate(stale_customers, 1):
            if not self.json_output and self.verbose:
                days_stale = (timezone.now() - customer.stripe_data_last_synced).days if customer.stripe_data_last_synced else 'never'
                self.stdout.write(f'\n  [{i}/{total}] Customer {customer.stripe_customer_id} (last sync: {days_stale} days ago)')

            try:
                self._sync_customer(customer.stripe_customer_id)
            except Exception as e:
                self.errors.append({
                    'type': 'customer',
                    'id': customer.stripe_customer_id,
                    'error': str(e)
                })
                if not self.json_output:
                    self.stdout.write(self.style.ERROR(f'    ✗ Error: {str(e)}'))

    def _sync_all_data(self, batch_size=None):
        """Sync all customers and subscriptions from Stripe."""
        if not self.json_output:
            self.stdout.write(self.style.WARNING('\n⚠️  WARNING: Full sync operation'))
            self.stdout.write(self.style.WARNING('This will sync ALL customers and subscriptions from Stripe.'))
            self.stdout.write(self.style.WARNING('This should only be used for:'))
            self.stdout.write(self.style.WARNING('  - Initial data migration'))
            self.stdout.write(self.style.WARNING('  - Emergency reconciliation'))
            self.stdout.write(self.style.WARNING('  - Weekly safety backstop'))
            self.stdout.write('')

        # Sync all customers
        self._sync_all_customers(batch_size)

        # Sync all subscriptions
        self._sync_all_subscriptions(batch_size)

    def _sync_all_customers(self, batch_size=None):
        """Sync all customers from Stripe."""
        if not self.json_output:
            self.stdout.write(self.style.HTTP_INFO('\n[1] Syncing All Customers from Stripe'))
            self.stdout.write('-' * 70)

        try:
            customers_synced = 0
            has_more = True
            starting_after = None

            while has_more:
                params = {'limit': 100}
                if starting_after:
                    params['starting_after'] = starting_after

                response = stripe.Customer.list(**params)

                for stripe_customer in response.data:
                    if batch_size and customers_synced >= batch_size:
                        has_more = False
                        break

                    if not self.json_output and self.verbose:
                        self.stdout.write(f'\n  Syncing customer {stripe_customer.id}...')

                    try:
                        self._sync_customer(stripe_customer.id, stripe_customer_obj=stripe_customer)
                        customers_synced += 1
                    except Exception as e:
                        self.errors.append({
                            'type': 'customer',
                            'id': stripe_customer.id,
                            'error': str(e)
                        })
                        if not self.json_output:
                            self.stdout.write(self.style.ERROR(f'    ✗ Error: {str(e)}'))

                has_more = response.has_more and (not batch_size or customers_synced < batch_size)
                if has_more and response.data:
                    starting_after = response.data[-1].id

            if not self.json_output:
                self.stdout.write(f'\n  Processed {customers_synced} customers from Stripe')

        except stripe.error.StripeError as e:
            if not self.json_output:
                self.stdout.write(self.style.ERROR(f'  ✗ Stripe API error: {str(e)}'))
            logger.error(f"Stripe API error during customer sync: {e}")

    def _sync_all_subscriptions(self, batch_size=None):
        """Sync all subscriptions from Stripe."""
        if not self.json_output:
            self.stdout.write(self.style.HTTP_INFO('\n[2] Syncing All Subscriptions from Stripe'))
            self.stdout.write('-' * 70)

        try:
            subscriptions_synced = 0
            has_more = True
            starting_after = None

            while has_more:
                params = {'limit': 100, 'status': 'all'}
                if starting_after:
                    params['starting_after'] = starting_after

                response = stripe.Subscription.list(**params)

                for stripe_subscription in response.data:
                    if batch_size and subscriptions_synced >= batch_size:
                        has_more = False
                        break

                    if not self.json_output and self.verbose:
                        self.stdout.write(f'\n  Syncing subscription {stripe_subscription.id}...')

                    try:
                        self._sync_subscription(stripe_subscription.id, stripe_subscription_obj=stripe_subscription)
                        subscriptions_synced += 1
                    except Exception as e:
                        self.errors.append({
                            'type': 'subscription',
                            'id': stripe_subscription.id,
                            'error': str(e)
                        })
                        if not self.json_output:
                            self.stdout.write(self.style.ERROR(f'    ✗ Error: {str(e)}'))

                has_more = response.has_more and (not batch_size or subscriptions_synced < batch_size)
                if has_more and response.data:
                    starting_after = response.data[-1].id

            if not self.json_output:
                self.stdout.write(f'\n  Processed {subscriptions_synced} subscriptions from Stripe')

        except stripe.error.StripeError as e:
            if not self.json_output:
                self.stdout.write(self.style.ERROR(f'  ✗ Stripe API error: {str(e)}'))
            logger.error(f"Stripe API error during subscription sync: {e}")

    def _sync_customer(self, stripe_customer_id, stripe_customer_obj=None):
        """Sync a single customer from Stripe."""
        self.stats['customers_processed'] += 1

        # Fetch from Stripe if not provided
        if not stripe_customer_obj:
            stripe_customer_obj = stripe.Customer.retrieve(stripe_customer_id)

        changes = []

        try:
            # Find local customer
            customer = Customer.objects.get(stripe_customer_id=stripe_customer_id)

            # Detect changes
            old_email = customer.stripe_metadata.get('email')
            new_email = stripe_customer_obj.email
            if old_email != new_email:
                changes.append(f'email: {old_email} → {new_email}')

            old_metadata = customer.stripe_metadata
            new_metadata = {
                'id': stripe_customer_obj.id,
                'email': stripe_customer_obj.email,
                'created': stripe_customer_obj.created,
            }
            if old_metadata != new_metadata:
                changes.append('metadata updated')

            if customer.sync_status != Customer.SyncStatus.SYNCED:
                changes.append(f'sync_status: {customer.sync_status} → SYNCED')

            # Apply changes if not dry run
            if changes and not self.dry_run:
                customer.stripe_metadata = new_metadata
                customer.stripe_data_last_synced = timezone.now()
                customer.sync_status = Customer.SyncStatus.SYNCED
                customer.sync_error_message = ''
                customer.save(update_fields=[
                    'stripe_metadata',
                    'stripe_data_last_synced',
                    'sync_status',
                    'sync_error_message'
                ])

            # Track stats
            if changes:
                self.stats['customers_updated'] += 1
                self.changes.append({
                    'type': 'customer',
                    'id': stripe_customer_id,
                    'email': stripe_customer_obj.email,
                    'changes': changes
                })

                if not self.json_output and self.verbose:
                    self.stdout.write(f'  Customer {stripe_customer_id} ({stripe_customer_obj.email}):')
                    for change in changes:
                        prefix = '    - Would update:' if self.dry_run else '    - Updated:'
                        self.stdout.write(self.style.WARNING(f'{prefix} {change}'))
            else:
                self.stats['customers_no_change'] += 1
                if not self.json_output and self.verbose:
                    self.stdout.write(self.style.SUCCESS(f'  Customer {stripe_customer_id}: No changes needed'))

        except Customer.DoesNotExist:
            # Customer doesn't exist locally - this might be expected
            changes.append('Customer exists in Stripe but not in local DB')
            self.stats['customers_errors'] += 1

            if not self.json_output and self.verbose:
                self.stdout.write(self.style.WARNING(
                    f'  ⚠ Customer {stripe_customer_id} not found locally (may need manual creation)'
                ))

    def _sync_subscription(self, stripe_subscription_id, stripe_subscription_obj=None):
        """Sync a single subscription from Stripe."""
        self.stats['subscriptions_processed'] += 1

        # Fetch from Stripe if not provided
        if not stripe_subscription_obj:
            stripe_subscription_obj = stripe.Subscription.retrieve(stripe_subscription_id)

        # Convert Stripe subscription to event format for handler
        event_data = {
            'id': stripe_subscription_obj.id,
            'type': 'customer.subscription.updated',
            'data': {
                'object': stripe_subscription_obj.to_dict()
            }
        }

        try:
            # Get subscription before sync to detect changes
            try:
                old_subscription = Subscription.objects.get(stripe_subscription_id=stripe_subscription_id)
                old_status = old_subscription.status
                old_tier = old_subscription.tier
                had_subscription = True
            except Subscription.DoesNotExist:
                old_status = None
                old_tier = None
                had_subscription = False

            # Apply sync if not dry run
            if not self.dry_run:
                # Reuse webhook handler logic for consistency
                handler = SubscriptionCreatedHandler(event_data)
                handler.handle()

            # Detect changes
            changes = []
            new_subscription = Subscription.objects.get(stripe_subscription_id=stripe_subscription_id)

            if not had_subscription:
                changes.append('Created subscription')
                self.stats['subscriptions_created'] += 1
            else:
                if old_status != new_subscription.status:
                    changes.append(f'status: {old_status} → {new_subscription.status}')
                if old_tier != new_subscription.tier:
                    changes.append(f'tier: {old_tier} → {new_subscription.tier}')
                if changes:
                    self.stats['subscriptions_updated'] += 1
                else:
                    self.stats['subscriptions_no_change'] += 1

            if changes:
                self.changes.append({
                    'type': 'subscription',
                    'id': stripe_subscription_id,
                    'customer_id': stripe_subscription_obj.customer,
                    'changes': changes
                })

                if not self.json_output and self.verbose:
                    self.stdout.write(f'  Subscription {stripe_subscription_id}:')
                    for change in changes:
                        prefix = '    - Would update:' if self.dry_run else '    - Updated:'
                        self.stdout.write(self.style.WARNING(f'{prefix} {change}'))
            else:
                if not self.json_output and self.verbose:
                    self.stdout.write(self.style.SUCCESS(f'  Subscription {stripe_subscription_id}: No changes needed'))

        except Customer.DoesNotExist:
            self.stats['subscriptions_errors'] += 1
            self.errors.append({
                'type': 'subscription',
                'id': stripe_subscription_id,
                'error': f'Customer {stripe_subscription_obj.customer} not found locally'
            })
            if not self.json_output:
                self.stdout.write(self.style.ERROR(
                    f'  ✗ Cannot sync subscription {stripe_subscription_id}: '
                    f'Customer {stripe_subscription_obj.customer} not found locally'
                ))
        except Exception as e:
            self.stats['subscriptions_errors'] += 1
            raise

    def _output_results(self):
        """Output final results."""
        elapsed_time = time.time() - self.start_time

        if self.json_output:
            # JSON output
            output = {
                'timestamp': timezone.now().isoformat(),
                'elapsed_time_seconds': round(elapsed_time, 2),
                'dry_run': self.dry_run,
                'stats': self.stats,
                'changes': self.changes,
                'errors': self.errors,
            }
            self.stdout.write(json.dumps(output, indent=2))
        else:
            # Human-readable summary
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('=' * 70))
            if self.dry_run:
                self.stdout.write(self.style.WARNING('Summary - DRY RUN'))
            else:
                self.stdout.write(self.style.SUCCESS('Summary - CHANGES APPLIED'))
            self.stdout.write(self.style.SUCCESS('=' * 70))

            # Customer stats
            self.stdout.write(f'Customers processed:     {self.stats["customers_processed"]}')
            if self.stats["customers_updated"] > 0:
                prefix = '  - Would update:' if self.dry_run else '  - Updated:'
                self.stdout.write(f'{prefix}        {self.stats["customers_updated"]}')
            if self.stats["customers_created"] > 0:
                prefix = '  - Would create:' if self.dry_run else '  - Created:'
                self.stdout.write(f'{prefix}        {self.stats["customers_created"]}')
            if self.stats["customers_no_change"] > 0:
                self.stdout.write(f'  - Already in sync:     {self.stats["customers_no_change"]}')
            if self.stats["customers_errors"] > 0:
                self.stdout.write(self.style.ERROR(f'  - Errors:              {self.stats["customers_errors"]}'))

            self.stdout.write('')

            # Subscription stats
            self.stdout.write(f'Subscriptions processed: {self.stats["subscriptions_processed"]}')
            if self.stats["subscriptions_updated"] > 0:
                prefix = '  - Would update:' if self.dry_run else '  - Updated:'
                self.stdout.write(f'{prefix}        {self.stats["subscriptions_updated"]}')
            if self.stats["subscriptions_created"] > 0:
                prefix = '  - Would create:' if self.dry_run else '  - Created:'
                self.stdout.write(f'{prefix}        {self.stats["subscriptions_created"]}')
            if self.stats["subscriptions_no_change"] > 0:
                self.stdout.write(f'  - Already in sync:     {self.stats["subscriptions_no_change"]}')
            if self.stats["subscriptions_errors"] > 0:
                self.stdout.write(self.style.ERROR(f'  - Errors:              {self.stats["subscriptions_errors"]}'))

            self.stdout.write('')
            self.stdout.write(f'Elapsed time:            {elapsed_time:.2f}s')
            self.stdout.write('')

            # Show errors if any
            if self.errors:
                self.stdout.write(self.style.ERROR('Errors encountered:'))
                for error in self.errors[:10]:  # Show first 10 errors
                    self.stdout.write(self.style.ERROR(f"  - {error['type']} {error['id']}: {error['error']}"))
                if len(self.errors) > 10:
                    self.stdout.write(self.style.ERROR(f'  ... and {len(self.errors) - 10} more errors'))
                self.stdout.write('')

            # Final message
            if self.dry_run:
                self.stdout.write(self.style.WARNING('NOTE: This was a DRY RUN. Use --apply to make actual changes.'))
            else:
                total_changes = self.stats['customers_updated'] + self.stats['subscriptions_updated'] + \
                               self.stats['customers_created'] + self.stats['subscriptions_created']
                if total_changes > 0:
                    self.stdout.write(self.style.SUCCESS(f'✓ Successfully synced {total_changes} records'))
                else:
                    self.stdout.write(self.style.SUCCESS('✓ All data already in sync'))

            self.stdout.write(self.style.SUCCESS('=' * 70))
