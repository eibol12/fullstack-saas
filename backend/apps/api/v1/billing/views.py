import logging
import stripe
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.billing.models import Customer, Subscription
from apps.billing.services import StripeService, SubscriptionService
from apps.billing.constants import STRIPE_PRODUCTS, STRIPE_CATALOG
from apps.billing.selectors import SaaSSelector
from apps.billing.handlers import process_webhook_event
from domain.saas.tier_policy import TierPolicy
from .serializers import (
    CustomerSerializer,
    SubscriptionSerializer,
    PlanSerializer,
    CheckoutSessionRequestSerializer,
    CheckoutSessionResponseSerializer,
    BillingPortalResponseSerializer,
    InvoiceSerializer,
    CapabilitiesSerializer,
)

logger = logging.getLogger(__name__)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def subscription(request):
    """Get current user's subscription information"""
    try:
        customer = request.user.customer

        #Get active subscription
        active_subscription = SubscriptionService.get_active_subscription(customer)

        data = {
            "customer": CustomerSerializer(customer).data,
            "subscription": SubscriptionSerializer(active_subscription).data if active_subscription else None,
        }

        return Response(data, status=status.HTTP_200_OK)

    except Customer.DoesNotExist:
        return Response(
            {"error": "Customer does not exist"},
            status=status.HTTP_404_NOT_FOUND
        )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_subscription(request):
    try:
        customer = request.user.customer
        active_subscription = SubscriptionService.get_active_subscription(customer)

        if not active_subscription:
            return Response(
                {"error": "Customer does not have an active subscription"},
                status=status.HTTP_400_BAD_REQUEST
            )

        #Cancel at period end (default)
        cancel_immediately = request.data.get('cancel_immediately', False)
        SubscriptionService.cancel_subscription(
            subscription=active_subscription,
            cancel_at_period_end= not cancel_immediately,
        )

        return Response({
            "message": "Subscription canceled successfully",
            "subscription": SubscriptionSerializer(active_subscription).data,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error canceling subscription: {str(e)}", exc_info=True)
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reactivate_subscription(request):
    """Reactivate subscription  that was set to cancel"""
    try:
        customer = request.user.customer
        cancel_at_period_end_subscription = SubscriptionService.get_active_subscription(customer)

        if not cancel_at_period_end_subscription:
            return Response(
                {"error": "No active subscription found to reactivate. If your subscription has already ended, please subscribe again."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not cancel_at_period_end_subscription.cancel_at_period_end:
            return Response(
                {"error": "Subscription is not set to cancel at period end"},
                status=status.HTTP_400_BAD_REQUEST
            )

        SubscriptionService.reactivate_subscription(cancel_at_period_end_subscription)

        return Response(
            {
                "message": "Subscription reactivated successfully",
                "subscription": SubscriptionSerializer(cancel_at_period_end_subscription).data,
            },
            status=status.HTTP_200_OK,
        )

    except Exception as e:
        logger.error(f"Error reactivating subscription: {str(e)}", exc_info=True)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_plan(request):
    """
    Change existing subscription to a different plan/price.

    This updates the existing Stripe subscription instead of creating a new one.
    Stripe handles proration automatically.

    Request body:
        price_id (str): New Stripe price ID to switch to

    Returns:
        200: Plan changed successfully
        400: No active subscription or invalid request
        500: Server error
    """
    try:
        customer = request.user.customer

        # Validate request data
        serializer = CheckoutSessionRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_price_id = serializer.validated_data['price_id']

        # Verify customer has an active subscription
        active_subscription = SubscriptionService.get_active_subscription(customer)
        if not active_subscription:
            return Response(
                {
                    'error': 'No active subscription found',
                    'detail': 'You must have an active subscription to change plans. Use the checkout endpoint to create a new subscription.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if already on this plan
        if active_subscription.stripe_price_id == new_price_id:
            return Response(
                {
                    'error': 'Already on this plan',
                    'detail': f'Your subscription is already using price {new_price_id}.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update subscription in Stripe
        updated_stripe_subscription = SubscriptionService.update_subscription_plan(
            subscription=active_subscription,
            new_price_id=new_price_id
        )

        # Refresh subscription from DB (webhook may have already updated it)
        active_subscription.refresh_from_db()

        return Response(
            {
                "message": "Plan changed successfully",
                "subscription": SubscriptionSerializer(active_subscription).data,
                "proration_note": "Proration charges/credits will appear on your next invoice."
            },
            status=status.HTTP_200_OK
        )

    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error changing plan: {str(e)}", exc_info=True)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def checkout_session(request):
    """
    Create a new checkout session for initial subscription signup.

    IMPORTANT: This endpoint is only for NEW subscriptions.
    If customer already has an active subscription, use the change_plan endpoint instead.
    """
    try:
        customer = request.user.customer

        #Validate request data
        serializer = CheckoutSessionRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        price_id = serializer.validated_data['price_id']

        # Check if customer already has an active subscription
        active_subscription = SubscriptionService.get_active_subscription(customer)
        if active_subscription:
            return Response(
                {
                    'error': 'Customer already has an active subscription',
                    'detail': f'Use the change-plan endpoint to modify your existing {active_subscription.tier} subscription.',
                    'current_subscription': {
                        'tier': active_subscription.tier,
                        'status': active_subscription.status,
                        'stripe_price_id': active_subscription.stripe_price_id,
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        #Default URLS (can be overriden in request)
        frontend_url = settings.FRONTEND_URL
        success_url = serializer.validated_data.get('success_url', f"{frontend_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}")
        cancel_url = serializer.validated_data.get('cancel_url', f"{frontend_url}/billing")

        #Create checkout session
        session = StripeService.create_checkout_session(
            customer=customer,
            price_id=price_id,
            success_url=success_url,
            cancel_url=cancel_url,
        )

        response_data = {
            "session_id": session.id,
            "checkout_url": session.url,
        }

        response_serializer = CheckoutSessionResponseSerializer(response_data)
        return Response(
            response_serializer.data,
            status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error creating checkout session: {str(e)}", exc_info=True)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def portal(request):
    """Create a stripe billing portal session for the user"""
    try:
        customer = request.user.customer

        #Default return URl
        frontend_url = settings.FRONTEND_URL
        return_url = request.data.get('return_url', f"{frontend_url}/billing")

        #Create portal session
        portal_session = StripeService.create_billing_portal_session(
            customer=customer,
            return_url=return_url,
        )

        response_data = {
            "portal_url": portal_session.url
        }

        response_serializer = BillingPortalResponseSerializer(response_data)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error creating portal session: {str(e)}", exc_info=True)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def invoices(request):
    """Get customer's invoices"""
    try:
        customer = request.user.customer

        #Get invoices
        invoices_list = StripeService.list_invoices(customer=customer, limit=20)
        #Serialize invoices
        invoice_data = []
        for invoice in invoices_list:
            invoice_data.append({
                "id":invoice.id,
                "amount_due":invoice.amount_due,
                "amount_paid":invoice.amount_paid,
                "currency":invoice.currency,
                "status":invoice.status,
                "created":invoice.created,
                "invoice_pdf":invoice.invoice_pdf,
                "hosted_invoice_url":invoice.hosted_invoice_url,
            })
        serializer = InvoiceSerializer(invoice_data, many=True)
        return Response(serializer.data,status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error fetching invoices: {str(e)}", exc_info=True)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(["GET"])
def plans(request):
    """
    Get list of available plans with all pricing intervals.

    No query params required - returns ALL prices (month and year) for each plan.
    Frontend decides which price to display based on user's toggle selection.

    Returns 3 plans (free, starter, pro) with nested prices structure:
    {
        "tier": "starter",
        "name": "Starter Plan",
        "description": "...",
        "prices": {
            "month": { "price_amount": 2900, "price_id": "...", "interval": "month" },
            "year": { "price_amount": 29000, "price_id": "...", "interval": "year" }
        },
        "features": [...],
        "is_current_plan": true
    }
    """
    try:
        plans_data = []

        # Get the current user's tier if authenticated
        current_tier = None
        if request.user.is_authenticated:
            try:
                current_tier = request.user.customer.tier
            except Customer.DoesNotExist:
                pass

        # Build plans list from STRIPE_CATALOG
        for tier, config in STRIPE_CATALOG.items():
            # Build nested prices dict with all available intervals
            prices_dict = {}
            for interval, price_data in config['prices'].items():
                prices_dict[interval] = {
                    "price_amount": price_data['unit_amount'],
                    "price_id": price_data['price_id'],
                    "interval": price_data['interval'],
                }

            plan_data = {
                "tier": tier,
                "name": config['name'],
                "description": config.get('description', ''),
                "prices": prices_dict if prices_dict else None,  # None if no prices (shouldn't happen)
                "is_current_plan": tier == current_tier,
            }
            plans_data.append(plan_data)

        serializer = PlanSerializer(plans_data, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error fetching plans: {str(e)}", exc_info=True)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def capabilities(request):
    """Get current user's tier capabilities and limits"""
    try:
        user = request.user

        # Get context via selector
        context = SaaSSelector.get_user_tier_context(user)

        # Get all limits and tier info using purified TierPolicy
        limits = TierPolicy.get_user_limits(context)

        # Fill in current usage from context
        limits['current_projects'] = context.project_count
        limits['current_analyses'] = context.max_analyses_in_any_project
        limits['current_designs'] = context.max_designs_in_any_analysis

        # Serialize and return
        serializer = CapabilitiesSerializer(limits)
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error fetching capabilities: {str(e)}", exc_info=True)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@require_POST
def stripe_webhook(request):
    """
    Handle incoming Stripe webhook events.
    Moved to API layer for centralized routing.
    """
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET

    if not webhook_secret:
        logger.error("STRIPE_WEBHOOK_SECRET is not configured.")
        return HttpResponse(status=500)

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=webhook_secret,
        )
    except ValueError as exc:
        logger.error("Invalid webhook payload: %s", str(exc))
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as exc:
        logger.error("Invalid webhook signature: %s", str(exc))
        return HttpResponse(status=400)

    logger.info("Received Stripe webhook event %s (%s)", event["id"], event["type"])

    try:
        # Convert stripe.Event object to dict for JSON serialization in DB
        event_dict = event._to_dict_recursive()
        success, _ = process_webhook_event(event_dict)
    except Exception as exc:
        logger.error(
            "Unexpected error while processing webhook %s: %s",
            event["id"],
            str(exc),
            exc_info=True,
        )
        return HttpResponse(status=500)

    if not success:
        logger.error("Webhook %s processing failed.", event["id"])
        return HttpResponse(status=500)

    return HttpResponse(status=200)
