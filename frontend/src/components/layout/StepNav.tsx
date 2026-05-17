import { useAppStore } from '../../stores/useAppStore'
import { t } from '../../lib/copy'
import { cn } from '../../lib/utils'
import { STEPS, type Step } from '../../types'

const stepKeys: Record<Step, string> = {
  dataInput: 'steps.dataInput',
  diagnostics: 'steps.diagnostics',
  validation: 'steps.validation',
  forecast: 'steps.forecast',
  export: 'steps.export',
}

export function StepNav() {
  const { currentStep, setStep, displayMode, timeSeriesData } = useAppStore()

  const currentIndex = STEPS.indexOf(currentStep)

  function isEnabled(step: Step): boolean {
    const idx = STEPS.indexOf(step)
    if (idx === 0) return true
    if (idx === 1) return !!timeSeriesData
    return idx <= currentIndex
  }

  return (
    <nav className="flex items-center gap-1">
      {STEPS.map((step, idx) => {
        const enabled = isEnabled(step)
        const active = step === currentStep
        const completed = idx < currentIndex

        return (
          <button
            key={step}
            onClick={() => enabled && setStep(step)}
            disabled={!enabled}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              active && 'bg-accent-blue text-white',
              completed && !active && 'bg-surface text-primary',
              !active && !completed && enabled && 'text-secondary hover:bg-surface',
              !enabled && 'text-secondary/40 cursor-not-allowed'
            )}
          >
            <span className="mr-2 text-xs opacity-60">{idx + 1}</span>
            {t(stepKeys[step], displayMode)}
          </button>
        )
      })}
    </nav>
  )
}
