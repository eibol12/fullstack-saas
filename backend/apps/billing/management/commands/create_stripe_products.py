from django.core.management.base import BaseCommand
from django.conf import settings
from apps.billing.constants import STRIPE_CATALOG
import stripe

stripe.api_key = settings.STRIPE_API_KEY

class Command(BaseCommand):
    help = 'Create Stripe products for the starter and pro plans'

    def handle(self, *args, **options):
        if not stripe.api_key:
            self.stdout.write(self.style.ERROR('STRIPE_API_KEY not configured'))
            return

        for tier, product_config in STRIPE_CATALOG.items():
            if tier == 'free':
                continue

            try:
                # Check if product already exists using Search API
                # Note: search is eventually consistent, but for this setup it is sufficient
                existing_products = stripe.Product.search(
                    query=f"metadata['tier']:'{tier}'",
                    limit=1
                )

                if existing_products.data:
                    product = existing_products.data[0]
                    self.stdout.write(
                        self.style.WARNING(
                            f"Found existing product: {product.id} ({product_config['name']})"
                        )
                    )
                else:
                    # Create product
                    product = stripe.Product.create(
                        name=product_config['name'],
                        description=product_config['description'],
                        metadata={'tier': tier}
                    )
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Created product: {product.id} ({product_config['name']})"
                        )
                    )

                created_prices = {}

                for billing_key, price_config in product_config['prices'].items():
                    if 'lookup_key' not in price_config:
                        continue

                    # Check if price already exists using search by lookup_key
                    existing_prices = stripe.Price.search(
                        query=f"lookup_key:'{price_config['lookup_key']}'",
                        limit=1
                    )

                    if existing_prices.data:
                        price = existing_prices.data[0]
                        self.stdout.write(
                            self.style.WARNING(
                                f"Found existing price: {price.id} "
                                f"({tier} {billing_key} - "
                                f"{price_config['unit_amount'] / 100:.2f} "
                                f"{price_config['currency'].upper()}/{price_config['interval']})"
                            )
                        )
                    else:
                        price = stripe.Price.create(
                            product = product.id,
                            unit_amount=price_config['unit_amount'],
                            currency=price_config['currency'],
                            recurring={'interval': price_config['interval']},
                            lookup_key=price_config['lookup_key'],
                            metadata = {
                                "tier": tier,
                                "billing_key": billing_key,
                            },
                        )
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"Created price: {price.id} "
                                f"({tier} {billing_key} - "
                                f"{price_config['unit_amount'] / 100:.2f} "
                                f"{price_config['currency'].upper()}/{price_config['interval']})"
                            )
                        )

                    created_prices[billing_key] = price.id

                self.stdout.write(
                    self.style.WARNING(
                        f"\nCatalog created for tier '{tier}':\n"
                        f"  product_id = {product.id}\n"
                        f"  monthly_price_id = {created_prices.get('month')}\n"
                        f"  yearly_price_id = {created_prices.get('year')}\n"
                    )
                )

            except stripe.error.StripeError as e:
                self.stdout.write(
                    self.style.ERROR(f"Error creating tier '{tier}': {str(e)}")
                )


# Creates:
# Product: "Starter Plan" → Price: 29/month,290/year
# Product: "Pro Plan" → Price: 99/month,990/year
# Sets metadata: tier=starter, tier=pro
