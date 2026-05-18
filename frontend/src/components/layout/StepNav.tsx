import { useAppStore } from '../../stores/useAppStore'
import { t } from '../../lib/copy'
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
    <nav className="flex items-center w-full">
      {STEPS.map((step, idx) => {
        const enabled = isEnabled(step)
        const active = step === currentStep
        const completed = idx < currentIndex

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            {/* Step chip — color covers circle + label together */}
            <button
              onClick={() => enabled && setStep(step)}
              disabled={!enabled}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-all ${
                active
                  ? 'bg-accent-blue text-white shadow-sm shadow-accent-blue/20'
                  : completed
                  ? 'bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/15 cursor-pointer'
                  : enabled
                  ? 'text-secondary hover:bg-surface cursor-pointer'
                  : 'text-secondary/30 cursor-not-allowed'
              }`}
            >
              {/* Circle */}
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  active
                    ? 'bg-white/25'
                    : completed
                    ? 'bg-accent-blue/20'
                    : enabled
                    ? 'bg-secondary/10 border border-secondary/15'
                    : 'bg-secondary/5'
                }`}
              >
                {completed ? '✓' : idx + 1}
              </div>

              {/* Label */}
              <span className="text-xs font-medium whitespace-nowrap">
                {t(stepKeys[step], displayMode)}
              </span>
            </button>

            {/* Connecting line */}
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mx-1 rounded-full transition-colors ${
                  completed ? 'bg-accent-blue/20' : 'bg-secondary/10'
                }`}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}
