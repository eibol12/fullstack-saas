from rest_framework import serializers
from apps.billing.models import Customer, Subscription
from domain.saas.constants import TIER_LIMITS
from domain.saas.types import Tier


# # apps/accounts/serializers.py
# class UserSerializer(serializers.ModelSerializer):
#     customer = CustomerSerializer(read_only=True)
#
#
# class CustomerSerializer(serializers.ModelSerializer):
#     tier = serializers.CharField(read_only=True)
#     subscription_active = serializers.BooleanField(read_only=True)


# # apps/billing/serializers.py
# class SubscriptionSerializer(serializers.ModelSerializer):
#     is_active = serializers.BooleanField(read_only=True)
#
# 
# class PlanSerializer(serializers.Serializer):
#     id = serializers.CharField()
#     name = serializers.CharField()
#     price = serializers.DecimalField(max_digits=10, decimal_places=2)
#     currency = serializers.CharField()
#     interval = serializers.CharField()
#     tier = serializers.CharField()
#     features = serializers.ListField()
#
#
# class CheckoutSessionRequestSerializer(serializers.Serializer):
#     price_id = serializers.CharField()
#     success_url = serializers.URLField()
#     cancel_url = serializers.URLField()
#
#
# class CheckoutSessionResponseSerializer(serializers.Serializer):
#     session_id = serializers.CharField()
#     checkout_url = serializers.URLField()

class SubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for customer subscription details."""
    is_active = serializers.SerializerMethodField()
    tier_display = serializers.CharField(source='get_tier_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Subscription
        fields = [
            'id',
            'tier',
            'tier_display',
            'status',
            'status_display',
            'is_active',
            'current_period_start',
            'current_period_end',
            'trial_start',
            'trial_end',
            'cancel_at_period_end',
            'canceled_at',
            'created_at',
        ]

    def get_is_active(self, obj):
        return obj.is_active()

class CustomerSerializer(serializers.ModelSerializer):
    """Serializer for customer billing information."""
    active_subscription = SubscriptionSerializer(read_only=True)
    tier_display = serializers.CharField(source='get_tier_display', read_only=True)
    tier_limits = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id',
            'tier',
            'tier_display',
            'subscription_active',
            'active_subscription',
            'tier_limits',
            'created_at',
        ]

    def get_tier_limits(self, obj):
        """Get feature limits for customer's tier."""
        return TIER_LIMITS.get(obj.tier, TIER_LIMITS[Tier.FREE])


class PlanSerializer(serializers.Serializer):
    """
    Serializer for available subscription plans.

    Returns nested prices structure with all billing intervals:
    {
        "tier": "starter",
        "name": "Starter Plan",
        "description": "...",
        "prices": {
            "month": { "price_amount": 2900, "price_id": "...", "interval": "month" },
            "year": { "price_amount": 29000, "price_id": "...", "interval": "year" }
        },
        "features": ["5 projects", "3 analyses per project", ...],
        "is_current_plan": false
    }
    """
    tier = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)
    prices = serializers.DictField(allow_null=True)  # Nested dict with month/year prices
    features = serializers.SerializerMethodField()
    is_current_plan = serializers.BooleanField(default=False)

    def get_features(self, obj):
        """
        Get feature list for this tier.

        Converts limit values to user-friendly strings:
        - None → "Unlimited"
        - Integers → "N projects"
        """
        tier = obj['tier']
        limits = TIER_LIMITS.get(tier, {})

        features = []

        # Projects limit
        max_projects = limits.get('max_projects')
        if max_projects is None:
            features.append("Unlimited projects")
        else:
            features.append(f"{max_projects} project{'s' if max_projects != 1 else ''}")

        # Analyses per project limit
        max_analyses = limits.get('max_analyses_per_project')
        if max_analyses is None:
            features.append("Unlimited analyses per project")
        else:
            features.append(f"{max_analyses} analyse{'s' if max_analyses != 1 else ''} per project")

        # Designs per analysis limit
        max_designs = limits.get('max_designs_per_analysis')
        if max_designs is None:
            features.append("Unlimited designs per analysis")
        else:
            features.append(f"{max_designs} design{'s' if max_designs != 1 else ''} per analysis")

        # Export capability
        if limits.get('can_export_pdf'):
            features.append("PDF export")

        # API access
        if limits.get('can_use_api'):
            features.append("API access")

        # Support level
        support_level = limits.get('support_level', '')
        if support_level == 'priority':
            features.append("Priority support")
        elif support_level == 'email':
            features.append("Email support")
        elif support_level == 'community':
            features.append("Community support")

        return features


class CheckoutSessionRequestSerializer(serializers.Serializer):
    """Request serializer for creating checkout session."""
    price_id = serializers.CharField(required=True)
    success_url = serializers.URLField(required=False)
    cancel_url = serializers.URLField(required=False)


class CheckoutSessionResponseSerializer(serializers.Serializer):
    """Response serializer for checkout session."""
    session_id = serializers.CharField()
    checkout_url = serializers.URLField()


class BillingPortalResponseSerializer(serializers.Serializer):
    """Response serializer for billing portal session."""
    portal_url = serializers.URLField()


class InvoiceSerializer(serializers.Serializer):
    """Serializer for invoice information."""
    id = serializers.CharField()
    amount_due = serializers.IntegerField()
    amount_paid = serializers.IntegerField()
    currency = serializers.CharField()
    status = serializers.CharField()
    created = serializers.IntegerField()
    invoice_pdf = serializers.URLField()
    hosted_invoice_url = serializers.URLField()


class CapabilitiesSerializer(serializers.Serializer):
    """Serializer for user's tier capabilities and limits."""
    current_tier = serializers.CharField()
    subscription_active = serializers.BooleanField()
    max_projects = serializers.IntegerField(allow_null=True)
    max_analyses_per_project = serializers.IntegerField(allow_null=True)
    max_designs_per_analysis = serializers.IntegerField(allow_null=True)
    can_export_pdf = serializers.BooleanField()
    can_use_api = serializers.BooleanField()
    support_level = serializers.CharField()
    current_projects = serializers.IntegerField()
    current_analyses = serializers.IntegerField()
    current_designs = serializers.IntegerField()






