import api from '../axios'
import { Capabilities } from '@/types/capabilities'
import {
  SubscriptionResponse,
  Plan,
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  BillingPortalResponse,
  CancelSubscriptionResponse,
  ReactivateSubscriptionResponse,
  ChangePlanRequest,
  ChangePlanResponse,
} from '@/types/billing'

/**
 * BILLING API ENDPOINTS
 *
 * Handles subscription, tier, and capabilities endpoints
 *
 * ENDPOINTS:
 * - GET  /api/v1/billing/capabilities/              Get user's tier capabilities and limits
 * - GET  /api/v1/billing/plans/                     Get available subscription plans
 * - GET  /api/v1/billing/subscription/              Get current subscription info
 * - POST /api/v1/billing/checkout/                  Create Stripe checkout session
 * - POST /api/v1/billing/portal/                    Create Stripe customer portal session
 * - POST /api/v1/billing/subscription/cancel/       Cancel subscription at period end
 * - POST /api/v1/billing/subscription/reactivate/   Reactivate canceled subscription
 * - POST /api/v1/billing/subscription/change-plan/  Change existing subscription to different plan
 */

export const billingApi = {
  /**
   * GET CAPABILITIES
   *
   * GET /api/v1/billing/capabilities/
   *
   * Returns current user's tier, limits, and feature access
   * Backend is source of truth for all entitlements
   */
  getCapabilities: async (): Promise<Capabilities> => {
    const { data } = await api.get('/billing/capabilities/')
    return data
  },

  /**
   * GET SUBSCRIPTION
   *
   * GET /api/v1/billing/subscription/
   *
   * Returns current user's customer and subscription details
   * Subscription will be null for FREE tier users
   */
  getSubscription: async (): Promise<SubscriptionResponse> => {
    const { data } = await api.get('/billing/subscription/')
    return data
  },

  /**
   * GET PLANS
   *
   * GET /api/v1/billing/plans/
   *
   * Returns available subscription plans with ALL pricing intervals.
   * No query params needed - backend returns both month and year prices.
   * Frontend selects which price to display based on toggle state.
   *
   * Public endpoint but marks current plan if authenticated
   */
  getPlans: async (): Promise<Plan[]> => {
    const { data } = await api.get('/billing/plans/')
    return data
  },

  /**
   * CREATE CHECKOUT SESSION
   *
   * POST /api/v1/billing/checkout/
   *
   * Creates a Stripe checkout session for subscription
   * Returns checkout URL to redirect user to Stripe
   */
  createCheckoutSession: async (
    request: CheckoutSessionRequest
  ): Promise<CheckoutSessionResponse> => {
    const { data } = await api.post('/billing/checkout/', request)
    return data
  },

  /**
   * CREATE BILLING PORTAL SESSION
   *
   * POST /api/v1/billing/portal/
   *
   * Creates a Stripe customer portal session
   * Returns portal URL to redirect user to Stripe for payment/invoice management
   */
  createPortalSession: async (returnUrl?: string): Promise<BillingPortalResponse> => {
    const { data } = await api.post('/billing/portal/', {
      return_url: returnUrl,
    })
    return data
  },

  /**
   * CANCEL SUBSCRIPTION
   *
   * POST /api/v1/billing/subscription/cancel/
   *
   * Cancels subscription at period end (default)
   * Subscription remains active until end of billing period
   */
  cancelSubscription: async (
    cancelImmediately = false
  ): Promise<CancelSubscriptionResponse> => {
    const { data } = await api.post('/billing/subscription/cancel/', {
      cancel_immediately: cancelImmediately,
    })
    return data
  },

  /**
   * REACTIVATE SUBSCRIPTION
   *
   * POST /api/v1/billing/subscription/reactivate/
   *
   * Reactivates a subscription that was set to cancel at period end
   * Removes the cancel_at_period_end flag
   */
  reactivateSubscription: async (): Promise<ReactivateSubscriptionResponse> => {
    const { data } = await api.post('/billing/subscription/reactivate/')
    return data
  },

  /**
   * CHANGE PLAN
   *
   * POST /api/v1/billing/subscription/change-plan/
   *
   * Changes existing subscription to a different plan/price
   * Updates the subscription in-place (no new subscription created)
   * Stripe handles proration automatically
   * Requires active subscription
   */
  changePlan: async (request: ChangePlanRequest): Promise<ChangePlanResponse> => {
    const { data } = await api.post('/billing/subscription/change-plan/', request)
    return data
  },
}
