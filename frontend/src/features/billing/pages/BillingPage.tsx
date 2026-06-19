import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  useSubscription,
  useCancelSubscription,
  useReactivateSubscription,
  useCreatePortal,
  billingKeys,
} from '@/features/billing/hooks/useBilling'
import { useCapabilities, capabilitiesKeys } from '@/features/billing/hooks/useCapabilities'
import { SubscriptionCard } from '@/features/billing/components/SubscriptionCard'
import { parseApiError } from '@/lib/errors'

/**
 * BillingPage Component
 *
 * Main subscription management page for authenticated users
 * Displays current subscription and provides billing actions:
 * - View subscription details
 * - Upgrade to higher tier
 * - Manage payment methods (via Stripe portal)
 * - Cancel subscription
 * - Reactivate canceled subscription
 */
export default function BillingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')
  const queryClient = useQueryClient()

  const { data: subscriptionData, isLoading, error: subscriptionError } = useSubscription()
  const { data: capabilities } = useCapabilities()
  const cancelSubscription = useCancelSubscription()
  const reactivateSubscription = useReactivateSubscription()
  const createPortal = useCreatePortal()

  // Handle checkout success
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (sessionId) {
      // Invalidate subscription and capabilities queries to force refetch with fresh data
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() })
      queryClient.invalidateQueries({ queryKey: capabilitiesKeys.current() })

      setSuccessMessage('Subscription updated successfully! Welcome to your new plan.')
      // Clean URL
      window.history.replaceState({}, '', '/billing')
    }
  }, [searchParams, queryClient])

  const handleUpgrade = () => {
    navigate('/pricing')
  }

  const handleManageBilling = async () => {
    try {
      setError('')
      await createPortal.mutateAsync(`${window.location.origin}/billing`)
    } catch (err) {
      setError(parseApiError(err))
    }
  }

  const handleCancelSubscription = async () => {
    if (
      !window.confirm(
        'Are you sure you want to cancel your subscription? You\'ll still have access until the end of your billing period.'
      )
    ) {
      return
    }

    try {
      setError('')
      setSuccessMessage('')
      await cancelSubscription.mutateAsync(false)
      setSuccessMessage('Subscription canceled. You\'ll have access until the end of your billing period.')
    } catch (err) {
      setError(parseApiError(err))
    }
  }

  const handleReactivateSubscription = async () => {
    try {
      setError('')
      setSuccessMessage('')
      await reactivateSubscription.mutateAsync()
      setSuccessMessage('Subscription reactivated! Your plan will continue at the next billing period.')
    } catch (err) {
      setError(parseApiError(err))
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading subscription...</p>
        </div>
      </div>
    )
  }

  if (subscriptionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600">Failed to load subscription details</p>
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

  const { customer, subscription } = subscriptionData || {}
  const isFree = customer?.tier === 'free' || !subscription
  const canCancel = subscription && subscription.is_active && !subscription.cancel_at_period_end
  const canReactivate = subscription && subscription.is_active && subscription.cancel_at_period_end

  return (
    <div className="bg-gray-50 py-8 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">Billing & Subscription</h1>
          <p className="mt-2 text-slate-600">
            Manage your subscription and billing settings
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 rounded-lg bg-green-50 p-4 border border-green-200 shadow-sm">
            <p className="text-sm text-green-800 font-medium">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200 shadow-sm">
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subscription Card */}
          <div className="lg:col-span-2">
            {customer && (
              <SubscriptionCard customer={customer} subscription={subscription || null} />
            )}
          </div>

          {/* Actions Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-5">Quick Actions</h3>
            <div className="space-y-3">
              {/* Upgrade Button */}
              {isFree && (
                <button
                  onClick={handleUpgrade}
                  className="w-full px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Upgrade Plan
                </button>
              )}

              {/* Manage Billing Button */}
              {!isFree && (
                <button
                  onClick={handleManageBilling}
                  disabled={createPortal.isPending}
                  className="w-full px-5 py-2.5 border-2 border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {createPortal.isPending ? 'Loading...' : 'Manage Payment Methods'}
                </button>
              )}

              {/* View Pricing Button */}
              <button
                onClick={handleUpgrade}
                className="w-full px-5 py-2.5 border-2 border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                View All Plans
              </button>

              {/* Cancel Button */}
              {canCancel && (
                <>
                  <div className="border-t border-slate-200 my-4"></div>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={cancelSubscription.isPending}
                    className="w-full px-5 py-2.5 border-2 border-red-300 text-red-700 font-medium rounded-lg hover:bg-red-50 hover:border-red-400 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {cancelSubscription.isPending ? 'Canceling...' : 'Cancel Subscription'}
                  </button>
                </>
              )}

              {/* Reactivate Button */}
              {canReactivate && (
                <>
                  <div className="border-t border-slate-200 my-4"></div>
                  <button
                    onClick={handleReactivateSubscription}
                    disabled={reactivateSubscription.isPending}
                    className="w-full px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {reactivateSubscription.isPending
                      ? 'Reactivating...'
                      : 'Reactivate Subscription'}
                  </button>
                </>
              )}
            </div>

            {/* Usage Summary */}
            {capabilities && (
              <>
                <div className="border-t border-slate-200 my-6"></div>
                <h4 className="text-sm font-semibold text-slate-900 mb-4">Usage Summary</h4>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <dt className="text-slate-600">Projects</dt>
                    <dd className="text-slate-900 font-semibold">
                      {capabilities.current_projects}
                      {capabilities.max_projects !== null
                        ? ` / ${capabilities.max_projects}`
                        : ' (Unlimited)'}
                    </dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-slate-600">Analyses</dt>
                    <dd className="text-slate-900 font-semibold">
                      {capabilities.current_analyses}
                      {capabilities.max_analyses_per_project !== null
                        ? ` / ${capabilities.max_analyses_per_project} per project`
                        : ' (Unlimited)'}
                    </dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-slate-600">Designs</dt>
                    <dd className="text-slate-900 font-semibold">
                      {capabilities.current_designs}
                      {capabilities.max_designs_per_analysis !== null
                        ? ` / ${capabilities.max_designs_per_analysis} per analysis`
                        : ' (Unlimited)'}
                    </dd>
                  </div>
                  <div className="border-t border-slate-100 pt-3 mt-3">
                    <div className="flex justify-between items-center mb-2">
                      <dt className="text-slate-600">PDF Export</dt>
                      <dd className={`text-xs font-semibold px-2 py-1 rounded ${
                        capabilities.can_export_pdf
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {capabilities.can_export_pdf ? 'Enabled' : 'Disabled'}
                      </dd>
                    </div>
                    <div className="flex justify-between items-center">
                      <dt className="text-slate-600">API Access</dt>
                      <dd className={`text-xs font-semibold px-2 py-1 rounded ${
                        capabilities.can_use_api
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {capabilities.can_use_api ? 'Enabled' : 'Disabled'}
                      </dd>
                    </div>
                  </div>
                </dl>
              </>
            )}
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl shadow-sm p-6">
          <h3 className="text-base font-semibold text-blue-900 mb-2">Need Help?</h3>
          <p className="text-sm text-blue-800">
            Have questions about your subscription or billing? Check out our{' '}
            <Link to="/docs" className="font-medium underline hover:no-underline">
              documentation
            </Link>{' '}
            or{' '}
            <a href="mailto:abel.osumi@grispen.com" className="font-medium underline hover:no-underline">
              contact support
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
