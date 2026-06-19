import { Plan, BillingInterval } from '@/types/billing'
import { TierName } from '@/types/capabilities'

interface PricingCardProps {
  plan: Plan
  interval?: BillingInterval
  isCurrentPlan?: boolean
  currentTier?: TierName
  hasActiveSubscription?: boolean
  onSelect: (priceId: string, plan: Plan) => void
  isLoading?: boolean
}

/**
 * PricingCard Component
 *
 * Displays a single pricing tier card with:
 * - Tier name and description
 * - Price (formatted for monthly/yearly based on interval toggle)
 * - Feature list with checkmarks
 * - CTA button with dynamic label:
 *   - "Current Plan" (disabled) if user is on this plan
 *   - "Upgrade" if higher tier than current
 *   - "Downgrade" if lower tier than current
 *   - "Subscribe" / "Get Started" if no active subscription
 *
 * Now reads prices from nested structure:
 * plan.prices.month or plan.prices.year
 */
export function PricingCard({
  plan,
  interval = 'month',
  isCurrentPlan = false,
  currentTier,
  hasActiveSubscription = false,
  onSelect,
  isLoading = false,
}: PricingCardProps) {
  // Get the price for the selected interval
  const selectedPrice = plan.prices?.[interval]
  const priceAmount = selectedPrice?.price_amount ?? 0
  const priceId = selectedPrice?.price_id ?? ''

  const handleSelect = () => {
    if (!isCurrentPlan && !isLoading && priceId) {
      onSelect(priceId, plan)
    }
  }

  // Format price for display
  const formattedPrice = priceAmount === 0
    ? 'Free'
    : `$${(priceAmount / 100).toFixed(0)}`

  const intervalText = interval === 'month' ? '/month' : interval === 'year' ? '/year' : ''

  // Determine button label and action type
  const getButtonLabel = () => {
    if (isLoading) return 'Loading...'
    if (isCurrentPlan) return 'Current Plan'
    if (!hasActiveSubscription) {
      return priceAmount === 0 ? 'Get Started' : 'Subscribe'
    }

    // User has active subscription and this is not their current plan
    // Determine if upgrade or downgrade
    if (currentTier && plan.tier !== currentTier) {
      const tierRank: Record<TierName, number> = { free: 0, starter: 1, pro: 2 }
      const currentRank = tierRank[currentTier] || 0
      const targetRank = tierRank[plan.tier] || 0

      if (targetRank > currentRank) return 'Upgrade'
      if (targetRank < currentRank) return 'Downgrade'
    }

    return 'Change Plan'
  }

  const buttonLabel = getButtonLabel()

  // Determine button style based on action
  const getButtonClassName = () => {
    const baseClasses = "w-full font-semibold rounded-lg text-sm px-6 py-3 text-center transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"

    if (isCurrentPlan) {
      return `${baseClasses} text-slate-600 bg-slate-100 border border-slate-200 cursor-not-allowed`
    }

    if (buttonLabel === 'Downgrade') {
      return `${baseClasses} text-slate-700 bg-white border-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 focus:ring-slate-500`
    }

    // Upgrade / Subscribe / Change Plan - softer blue color
    return `${baseClasses} text-white bg-blue-500 hover:bg-blue-600 shadow-sm hover:shadow focus:ring-blue-500`
  }

  const isPro = plan.tier === 'pro'

  return (
    <div className={`flex flex-col p-8 mx-auto max-w-lg text-center bg-white rounded-xl border-2 transition-all hover:shadow-lg ${
      isPro ? 'border-blue-500 shadow-md' : 'border-slate-200 shadow-sm'
    } ${isCurrentPlan ? 'ring-2 ring-blue-200' : ''}`}>
      {/* Tier Name */}
      <div className="mb-2">
        {isPro && (
          <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full mb-3">
            Most Popular
          </span>
        )}
        <h3 className="text-2xl font-bold text-slate-900">{plan.name}</h3>
      </div>

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div className="mb-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
            ✓ Current Plan
          </span>
        </div>
      )}

      {/* Price */}
      <div className="flex justify-center items-baseline my-6">
        <span className="text-5xl font-extrabold text-slate-900">{formattedPrice}</span>
        {intervalText && (
          <span className="ml-2 text-slate-500 font-medium">{intervalText}</span>
        )}
      </div>

      {/* Features List */}
      <ul role="list" className="mb-8 space-y-3 text-left flex-grow">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start space-x-3">
            {/* Checkmark Icon */}
            <svg
              className="flex-shrink-0 w-5 h-5 text-blue-600 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-slate-700 text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={handleSelect}
        disabled={isCurrentPlan || isLoading || !priceId}
        className={getButtonClassName()}
      >
        {buttonLabel}
      </button>
    </div>
  )
}
