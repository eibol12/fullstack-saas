import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '@/api/endpoints/billing'
import { useIsAuthenticated } from '@/features/auth/stores/authStore'
import { CheckoutSessionRequest, ChangePlanRequest } from '@/types/billing'
import { capabilitiesKeys } from './useCapabilities'

/**
 * React Query keys for billing
 */
export const billingKeys = {
  all: ['billing'] as const,
  subscription: () => [...billingKeys.all, 'subscription'] as const,
  plans: () => [...billingKeys.all, 'plans'] as const,
}

/**
 * Hook to fetch current user's subscription
 *
 * Returns customer and subscription details
 * Subscription will be null for FREE tier users
 */
export function useSubscription() {
  const isAuthenticated = useIsAuthenticated()


  return useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: () => billingApi.getSubscription(),
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Hook to fetch available subscription plans
 *
 * Returns ALL plans with both month and year pricing.
 * No interval param needed - backend returns all prices at once.
 * Frontend decides which price to display based on toggle state.
 *
 * Public endpoint - can be called without authentication
 * If authenticated, marks current plan with is_current_plan flag
 */
export function usePlans() {
  return useQuery({
    queryKey: billingKeys.plans(),
    queryFn: () => billingApi.getPlans(),
    staleTime: 10 * 60 * 1000, // 10 minutes - plans don't change often
  })
}

/**
 * Hook to create Stripe checkout session
 *
 * On success, redirects user to Stripe checkout page
 * Checkout page will redirect back to success_url or cancel_url
 */
export function useCreateCheckout() {
  return useMutation({
    mutationFn: (request: CheckoutSessionRequest) =>
      billingApi.createCheckoutSession(request),
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      window.location.href = data.checkout_url
    },
  })
}

/**
 * Hook to create Stripe customer portal session
 *
 * On success, redirects user to Stripe customer portal
 * Portal handles payment methods, invoices, and customer info
 */
export function useCreatePortal() {
  return useMutation({
    mutationFn: (returnUrl?: string) => billingApi.createPortalSession(returnUrl),
    onSuccess: (data) => {
      // Redirect to Stripe portal
      window.location.href = data.portal_url
    },
  })
}

/**
 * Hook to cancel subscription
 *
 * Cancels subscription at period end by default
 * Subscription remains active until end of billing period
 * Invalidates subscription and capabilities queries on success
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (cancelImmediately: boolean = false) =>
      billingApi.cancelSubscription(cancelImmediately),
    onSuccess: () => {
      // Invalidate subscription to refetch updated cancel status
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() })
      // Invalidate capabilities in case limits changed
      queryClient.invalidateQueries({ queryKey: capabilitiesKeys.current() })
    },
  })
}

/**
 * Hook to reactivate subscription
 *
 * Removes cancel_at_period_end flag
 * Subscription will continue at next billing period
 * Invalidates subscription and capabilities queries on success
 */
export function useReactivateSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => billingApi.reactivateSubscription(),
    onSuccess: () => {
      // Invalidate subscription to refetch updated cancel status
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() })
      // Invalidate capabilities in case limits changed
      queryClient.invalidateQueries({ queryKey: capabilitiesKeys.current() })
    },
  })
}

/**
 * Hook to change subscription plan
 *
 * Changes existing subscription to a different plan/price
 * Updates the subscription in-place (no new subscription created)
 * Stripe handles proration automatically
 * Requires active subscription
 * Invalidates subscription and capabilities queries on success
 */
export function useChangePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ChangePlanRequest) => billingApi.changePlan(request),
    onSuccess: () => {
      // Invalidate subscription to refetch updated plan details
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() })
      // Invalidate capabilities to refetch updated limits
      queryClient.invalidateQueries({ queryKey: capabilitiesKeys.current() })
      // Invalidate plans to update current_plan flags
      queryClient.invalidateQueries({ queryKey: billingKeys.plans() })
    },
  })
}
