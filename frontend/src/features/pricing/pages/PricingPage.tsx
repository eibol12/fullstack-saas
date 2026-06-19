import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePlans, useCreateCheckout, useChangePlan, useSubscription, billingKeys } from '@/features/billing/hooks/useBilling'
import { PricingCard } from '@/features/pricing/components/PricingCard'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { BillingInterval, Plan } from '@/types/billing'
import { parseApiError } from '@/lib/errors'

/**
 * PricingPage Component
 *
 * Displays subscription pricing plans
 * Accessible to both authenticated and unauthenticated users
 * Handles both initial checkout and plan changes
 *
 * Flow:
 * - If user has no active subscription: Create checkout session → redirect to Stripe
 * - If user has active subscription: Show confirmation → Call change-plan API → show success message
 */
export default function PricingPage() {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month')
  const [error, setError] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<{ priceId: string; plan: Plan } | null>(null)

  const queryClient = useQueryClient()
  const { data: plans, isLoading: plansLoading, error: plansError } = usePlans()
  const { data: subscriptionData, refetch: refetchSubscription } = useSubscription()
  const createCheckout = useCreateCheckout()
  const changePlan = useChangePlan()

  // Determine if user has active subscription
  const hasActiveSubscription = subscriptionData?.subscription?.is_active || false
  const currentSubscription = subscriptionData?.subscription || null

  // Calculate isCurrentPlan client-side from subscription data for accurate state
  const getCurrentPlanForTier = (tierName: string): boolean => {
    if (!currentSubscription) return false
    return currentSubscription.tier === tierName
  }

  // Determine if selected plan is upgrade or downgrade
  const getChangeType = (): 'upgrade' | 'downgrade' | null => {
    if (!selectedPlan || !currentSubscription) return null

    const tierRank: Record<string, number> = { free: 0, starter: 1, pro: 2 }
    const currentRank = tierRank[currentSubscription.tier] || 0
    const targetRank = tierRank[selectedPlan.plan.tier] || 0

    if (targetRank > currentRank) return 'upgrade'
    if (targetRank < currentRank) return 'downgrade'
    return null
  }

  const handleSelectPlan = async (priceId: string, plan: Plan) => {
    setError('')
    setSuccessMessage('')

    if (hasActiveSubscription) {
      // User has active subscription → show confirmation modal
      setSelectedPlan({ priceId, plan })
      setShowConfirmModal(true)
    } else {
      // User has no active subscription → proceed directly to checkout
      try {
        await createCheckout.mutateAsync({
          price_id: priceId,
          success_url: `${window.location.origin}/billing?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${window.location.origin}/pricing`,
        })
        // Note: createCheckout redirects to Stripe on success, so code below won't run
      } catch (err) {
        const errorMessage = parseApiError(err)

        // Handle specific backend errors gracefully
        if (errorMessage.includes('already has an active subscription')) {
          setError(
            'You already have an active subscription. Please use the "Change Plan" option on the Billing page or try refreshing this page.'
          )
        } else if (errorMessage.includes('no active subscription')) {
          setError(
            'No active subscription found. Please try subscribing again or contact support if the issue persists.'
          )
        } else {
          setError(errorMessage)
        }

        // Scroll to top to show error message
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  const handleConfirmPlanChange = async () => {
    if (!selectedPlan) return
    const { priceId, plan } = selectedPlan

    try {
      setError('')
      setSuccessMessage('')

      // Execute plan change
      const response = await changePlan.mutateAsync({ price_id: priceId })

      // Close modal
      setShowConfirmModal(false)
      setSelectedPlan(null)

      // The backend relies on Stripe webhooks to update the local database.
      // We add a brief delay to allow the webhook to process before refetching,
      // and we optimistically update the cache so the UI feels instant.
      if (response.subscription) {
        // Optimistically update the subscription tier to the newly selected plan
        // This makes the UI update immediately without waiting for the webhook
        queryClient.setQueryData(billingKeys.subscription(), (old: any) => {
          if (!old || !old.subscription) return old;
          return {
            ...old,
            subscription: {
              ...old.subscription,
              tier: plan.tier,
              tier_display: plan.name,
              stripe_price_id: priceId
            },
            customer: {
              ...old.customer,
              tier: plan.tier,
              tier_display: plan.name
            }
          };
        });
      }

      // Add a small delay then refetch to get the true synchronized state
      setTimeout(async () => {
        await refetchSubscription()
        queryClient.invalidateQueries({ queryKey: billingKeys.plans() })
      }, 2000)

      // Show success message
      setSuccessMessage(
        `${response.message} ${response.proration_note || 'Your subscription has been updated.'}`
      )

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      const errorMessage = parseApiError(err)

      // Close modal
      setShowConfirmModal(false)
      setSelectedPlan(null)

      // Handle specific backend errors gracefully
      if (errorMessage.includes('already has an active subscription')) {
        setError(
          'You already have an active subscription. Please use the "Change Plan" option on the Billing page or try refreshing this page.'
        )
      } else if (errorMessage.includes('no active subscription')) {
        setError(
          'No active subscription found. Please try subscribing again or contact support if the issue persists.'
        )
      } else {
        setError(errorMessage)
      }

      // Scroll to top to show error message
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleCancelConfirmation = () => {
    setShowConfirmModal(false)
    setSelectedPlan(null)
  }

  if (plansLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading pricing plans...</p>
        </div>
      </div>
    )
  }

  if (plansError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600">Failed to load pricing plans</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const isLoading = createCheckout.isPending || changePlan.isPending

  // Build confirmation modal content
  const changeType = getChangeType()
  const confirmationTitle = 'Confirm Plan Change'
  const confirmationMessage = selectedPlan && currentSubscription ? (
    <div className="space-y-3">
      <p>
        You are about to change from{' '}
        <span className="font-semibold">{currentSubscription.tier_display || currentSubscription.tier}</span> to{' '}
        <span className="font-semibold">{selectedPlan.plan.name}</span>.
      </p>
      {changeType === 'upgrade' && (
        <p className="text-sm">
          Stripe may charge the prorated difference immediately to your current payment method.
        </p>
      )}
      {changeType === 'downgrade' && (
        <p className="text-sm">
          Any unused prorated amount may be applied as a credit toward future billing.
        </p>
      )}
      <p className="text-sm font-medium">Do you want to continue?</p>
    </div>
  ) : (
    'Are you sure you want to change your plan?'
  )

  return (
    <section className="bg-gray-50 min-h-screen py-12">
      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            Powerful lifting analysis tools for rigging professionals. Upgrade anytime to
            unlock more features and capacity.
          </p>

          {/* Billing Interval Toggle */}
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setBillingInterval('month')}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
                billingInterval === 'month'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('year')}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
                billingInterval === 'year'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Yearly
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="max-w-3xl mx-auto mb-8">
            <div className="rounded-lg bg-green-50 p-4 border border-green-200 shadow-sm">
              <p className="text-sm text-green-800 font-medium">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="max-w-3xl mx-auto mb-8">
            <div className="rounded-lg bg-red-50 p-4 border border-red-200 shadow-sm">
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
          {plans?.map((plan) => (
            <PricingCard
              key={plan.tier}
              plan={plan}
              interval={billingInterval}
              isCurrentPlan={getCurrentPlanForTier(plan.tier)}
              currentTier={currentSubscription?.tier}
              hasActiveSubscription={hasActiveSubscription}
              onSelect={(priceId) => handleSelectPlan(priceId, plan)}
              isLoading={isLoading}
            />
          ))}
        </div>

        {/* Additional Info */}
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <p className="text-sm text-slate-600">
              All plans include access to our core DNV lifting calculation engine.
              <br />
              Need enterprise features? <a href="mailto:abel.osumi@grispen.com" className="text-blue-600 hover:text-blue-700 font-medium">Contact us</a> for custom plans.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleCancelConfirmation}
        onConfirm={handleConfirmPlanChange}
        title={confirmationTitle}
        message={confirmationMessage}
        confirmLabel="Change Plan"
        cancelLabel="Cancel"
        isLoading={changePlan.isPending}
      />
    </section>
  )
}
