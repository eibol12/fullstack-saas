# STRIPE_CATALOG: Source of truth for billing plans
# Supports multiple intervals (month/year) per tier
# NOTE: Keys standardized to 'month' and 'year' to match frontend

# DEPRECATED: Use STRIPE_CATALOG instead
# Stripe Product IDs (will be populated after running create_stripe_products)
# This is kept for backward compatibility only
STRIPE_PRODUCTS = {
    'free': {
        'product_id': '',  # Free tier has no Stripe product
        'price_id': '',
        'name': 'Free',
        'price_amount': 0,
        'interval': None,
    },
    'starter': {
        'product_id': 'prod_XXXXXXXX',  # Replace after creating in Stripe
        'price_id': 'price_XXXXXXXX',  # Replace after creating in Stripe
        'name': 'Starter',
        'price_amount': 2900,  # $29.00
        'interval': 'month',
    },
    'pro': {
        'product_id': 'prod_YYYYYYYY',  # Replace after creating in Stripe
        'price_id': 'price_YYYYYYYY',  # Replace after creating in Stripe
        'name': 'Pro',
        'price_amount': 9900,  # $99.00
        'interval': 'month',
    },
}

from django.conf import settings

STRIPE_CATALOG = {
    "free": {
        "name": "Free",
        "description": "Get started with basic features",
        "prices": {
            "month": {
                "unit_amount": 0,
                "interval": "month",
                "currency": "usd",
                "price_id": "",  # No Stripe price for free tier
            }
        }
    },
    "starter": {
        "name": "Starter Plan",
        "description": "Perfect for small teams or individual users",
        "prices": {
            "month": {
                "unit_amount": 2900,
                "interval": "month",
                "currency": "usd",
                "lookup_key": "starter_monthly",
                "price_id": getattr(settings, 'STRIPE_PRICE_STARTER_MONTH', '')
            },
            "year": {
                "unit_amount": 29000,
                "interval": "year",
                "currency": "usd",
                "lookup_key": "starter_yearly",
                "price_id": getattr(settings, 'STRIPE_PRICE_STARTER_YEAR', '')
            }
        }
    },
    "pro": {
        "name": "Pro Plan",
        "description": "For professionals and growing teams",
        "prices": {
            "month": {
                "unit_amount": 6000,
                "interval": "month",
                "currency": "usd",
                "lookup_key": "pro_monthly",
                "price_id": getattr(settings, 'STRIPE_PRICE_PRO_MONTH', '')
            },
            "year": {
                "unit_amount": 60000,
                "interval": "year",
                "currency": "usd",
                "lookup_key": "pro_yearly",
                "price_id": getattr(settings, 'STRIPE_PRICE_PRO_YEAR', '')
            },
        }
    }
}


# Map Stripe price IDs to tiers (for webhook handlers)
def get_tier_from_price_id(price_id):
    """
    Map Stripe price ID to tier name.

    Used by webhook handlers to identify which tier a subscription belongs to.
    """
    for tier, config in STRIPE_CATALOG.items():
        for interval, price_data in config.get('prices', {}).items():
            if price_data.get('price_id') == price_id:
                return tier
    return 'free'


# DEPRECATED: Use get_tier_from_price_id instead
def get_tier_from_product_id(product_id):
    """Map Stripe product ID to tier name. DEPRECATED."""
    for tier, config in STRIPE_PRODUCTS.items():
        if config.get('product_id') == product_id:
            return tier
    return 'free'
