import { TierName } from './capabilities'

// ============================================
// BILLING & SUBSCRIPTION TYPES
// ============================================

/**
 * Billing interval for subscriptions
 */
export type BillingInterval = 'month' | 'year'

/**
 * Subscription status from Stripe
 */
export type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'

/**
 * Subscription model - matches backend SubscriptionSerializer
 */
export interface Subscription {
  id: string
  tier: TierName
  tier_display: string
  status: SubscriptionStatus
  status_display: string
  is_active: boolean
  current_period_start: string | null
  current_period_end: string | null
  trial_start: string | null
  trial_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  created_at: string
}

/**
 * Customer model - matches backend CustomerSerializer
 */
export interface Customer {
  id: string
  tier: TierName
  tier_display: string
  subscription_active: boolean
  active_subscription: Subscription | null
  tier_limits: {
    max_projects: number | null
    max_analyses_per_project: number | null
    max_designs_per_analysis: number | null
    can_export_pdf: boolean
    can_use_api: boolean
    support_level: string
  }
  created_at: string
}

/**
 * Subscription response - includes customer and subscription
 * Returned from GET /api/v1/billing/subscription/
 */
export interface SubscriptionResponse {
  customer: Customer
  subscription: Subscription | null
}

/**
 * Price information for a specific billing interval
 */
export interface PlanPrice {
  price_amount: number // in cents
  price_id: string
  interval: BillingInterval
}

/**
 * Plan model - matches backend PlanSerializer
 *
 * Now includes nested prices structure with both month and year options.
 * Frontend selects which price to display based on toggle state.
 */
export interface Plan {
  tier: TierName
  name: string
  description?: string
  prices: {
    month: PlanPrice
    year: PlanPrice
  } | null // null for free tier (no Stripe prices)
  features: string[]
  is_current_plan: boolean
}

/**
 * Checkout session request - sent to POST /api/v1/billing/checkout/
 */
export interface CheckoutSessionRequest {
  price_id: string
  success_url?: string
  cancel_url?: string
}

/**
 * Checkout session response - returned from POST /api/v1/billing/checkout/
 */
export interface CheckoutSessionResponse {
  session_id: string
  checkout_url: string
}

/**
 * Billing portal response - returned from POST /api/v1/billing/portal/
 */
export interface BillingPortalResponse {
  portal_url: string
}

/**
 * Cancel subscription response
 */
export interface CancelSubscriptionResponse {
  message: string
  subscription: Subscription
}

/**
 * Reactivate subscription response
 */
export interface ReactivateSubscriptionResponse {
  message: string
  subscription: Subscription
}

/**
 * Change plan request - sent to POST /api/v1/billing/subscription/change-plan/
 */
export interface ChangePlanRequest {
  price_id: string
}

/**
 * Change plan response - returned from POST /api/v1/billing/subscription/change-plan/
 */
export interface ChangePlanResponse {
  message: string
  subscription: Subscription
  proration_note: string
}
