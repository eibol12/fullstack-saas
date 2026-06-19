import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export type StepId = 'basic' | 'geometry' | 'review'

interface Step {
  id: StepId
  label: string
  description: string
}

export const ANALYSIS_FORM_STEPS: readonly Step[] = [
  { id: 'basic',    label: 'Basic Info', description: 'Name, weight & scenario' },
  { id: 'geometry', label: 'Geometry',   description: 'Crane height & lift points' },
  { id: 'review',   label: 'Review',     description: 'Confirm & calculate' },
] as const

interface AnalysisFormStepperProps {
  currentStep: StepId
  visitedSteps: ReadonlySet<StepId>
  onStepChange: (step: StepId) => void
}

/**
 * AnalysisFormStepper
 *
 * Horizontal step indicator for the AnalysisForm. Clicking a previously visited
 * step jumps back to it; future steps are disabled until the user advances
 * through the Next button so we don't bypass per-step validation.
 */
export function AnalysisFormStepper({
  currentStep,
  visitedSteps,
  onStepChange,
}: AnalysisFormStepperProps) {
  const currentIndex = ANALYSIS_FORM_STEPS.findIndex((s) => s.id === currentStep)

  return (
    <ol className="flex w-full items-stretch gap-2" aria-label="Analysis form steps">
      {ANALYSIS_FORM_STEPS.map((step, index) => {
        const isCurrent = step.id === currentStep
        const isCompleted = index < currentIndex
        const isVisited = visitedSteps.has(step.id)
        const isClickable = isVisited && !isCurrent

        return (
          <li key={step.id} className="flex-1">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepChange(step.id)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
                isCurrent
                  ? 'border-primary/60 bg-primary/5 shadow-inset-soft'
                  : 'border-border bg-card hover:border-primary/40',
                !isClickable && !isCurrent && 'opacity-60 cursor-not-allowed',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-semibold',
                  isCompleted
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : isCurrent
                      ? 'border-primary/60 bg-primary text-primary-foreground'
                      : 'border-border bg-muted text-muted-foreground',
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight text-foreground">
                  {step.label}
                </span>
                <span className="block text-xs text-muted-foreground truncate">
                  {step.description}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
