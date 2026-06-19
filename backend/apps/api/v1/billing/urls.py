from django.urls import path
from . import views as billing_views


# urlpatterns = [
#     path("plans", billing_views.plans), #GET List available subscription plans
#     path("subscription", billing_views.subscription), #GET Get current subscription
#     path("subscription/cancel/", billing_views.subscription), #POST Get current subscription
#     path("subscription/reactivate/", billing_views.subscription), #POST Get current subscription
#     path("subscription/upgrate/", billing_views.subscription), #POST Get current subscription
#     path("checkout", billing_views.checkout_session), #POST Create a checkout session
#     path("portal", billing_views.portal), #POST Create a billing portal session
#     path("invoices", billing_views.invoices), #POST Create a billing portal session
#     path("payment-methods", billing_views.payment_methods), #POST Create a billing portal session
# ]

urlpatterns = [
    #Public endpoint
    path("plans/", billing_views.plans, name="plans"),
    path("webhooks/stripe/", billing_views.stripe_webhook, name="stripe-webhook"),

    # Authenticated endpoint
    path("subscription/", billing_views.subscription, name="subscription"),
    path("subscription/cancel/", billing_views.cancel_subscription, name="cancel-subscription"),
    path("subscription/reactivate/", billing_views.reactivate_subscription, name="reactivate-subscription"),
    path("subscription/change-plan/", billing_views.change_plan, name="change-plan"),

    #Checkout and billing
    path("checkout/", billing_views.checkout_session, name="checkout"),
    path("portal/", billing_views.portal, name="portal"),

    #Invoices
    path("invoices/", billing_views.invoices, name="invoices"),

    # User capabilities
    path("capabilities/", billing_views.capabilities, name="capabilities"),
]