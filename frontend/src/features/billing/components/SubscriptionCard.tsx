import { Customer, Subscription } from '@/types/billing'
import { format } from 'date-fns'

interface SubscriptionCardProps {
  customer: Customer
  subscription: Subscription | null
}

/**
 * SubscriptionCard Component
 *
 * Displays current subscription/customer details:
 * - Current tier and status
 * - Billing period dates
 * - Cancel at period end warning
 */
export function SubscriptionCard({ customer, subscription }: SubscriptionCardProps) {
  const isFree = customer.tier === 'free' || !subscription

  // Format dates
  const periodStart = subscription?.current_period_start
    ? format(new Date(subscription.current_period_start), 'MMM d, yyyy')
    : null

  const periodEnd = subscription?.current_period_end
    ? format(new Date(subscription.current_period_end), 'MMM d, yyyy')
    : null

  // Status badge color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'trialing':
        return 'bg-blue-100 text-blue-800'
      case 'past_due':
      case 'canceled':
      case 'unpaid':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {customer.tier_display} Plan
          </h2>
          {!isFree && subscription && (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                subscription.status
              )}`}
            >
              {subscription.status_display}
            </span>
          )}
        </div>
      </div>

      {/* Subscription Details */}
      {!isFree && subscription ? (
        <div className="space-y-4">
          {/* Cancel Warning */}
          {subscription.cancel_at_period_end && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-yellow-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Subscription Ending
                  </h3>
                  <p className="mt-1 text-sm text-yellow-700">
                    Your subscription will end on {periodEnd}. You'll still have access
                    until then.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Billing Period */}
          {periodStart && periodEnd && (
            <div className="border-t border-gray-200 pt-4">
              <dl className="space-y-3">
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-600">Current Period</dt>
                  <dd className="text-gray-900 font-medium">
                    {periodStart} - {periodEnd}
                  </dd>
                </div>
                {subscription.trial_end && new Date(subscription.trial_end) > new Date() && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-600">Trial Ends</dt>
                    <dd className="text-gray-900 font-medium">
                      {format(new Date(subscription.trial_end), 'MMM d, yyyy')}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Key Features */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Plan Features</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              {customer.tier_limits.max_projects === null ? (
                <li>• Unlimited projects</li>
              ) : (
                <li>• Up to {customer.tier_limits.max_projects} projects</li>
              )}
              {customer.tier_limits.max_analyses_per_project === null ? (
                <li>• Unlimited analyses per project</li>
              ) : (
                <li>• Up to {customer.tier_limits.max_analyses_per_project} analyses per project</li>
              )}
              {customer.tier_limits.max_designs_per_analysis === null ? (
                <li>• Unlimited designs per analysis</li>
              ) : (
                <li>• Up to {customer.tier_limits.max_designs_per_analysis} designs per analysis</li>
              )}
              {customer.tier_limits.can_export_pdf && <li>• PDF export</li>}
              {customer.tier_limits.can_use_api && <li>• API access</li>}
              <li>• {customer.tier_limits.support_level} support</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="text-gray-600">
          <p className="mb-4">
            You're currently on the Free plan. Upgrade to unlock more features and
            increase your limits.
          </p>
          <ul className="space-y-2 text-sm">
            <li>• {customer.tier_limits.max_projects} project limit</li>
            <li>• Community support only</li>
            <li>• No PDF export</li>
          </ul>
        </div>
      )}
    </div>
  )
}
