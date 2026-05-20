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

// Each step has its own color identity — active, completed, and connector line
const STEP_COLORS: Record<Step, {
  active: string
  completed: string
  completedDot: string
  line: string
}> = {
  dataInput:   {
    active: 'bg-accent-blue text-white shadow-sm shadow-accent-blue/20',
    completed: 'bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/15',
    completedDot: 'bg-accent-blue/20',
    line: 'bg-accent-blue/25',
  },
  diagnostics: {
    active: 'bg-accent-teal text-white shadow-sm shadow-accent-teal/20',
    completed: 'bg-accent-teal/10 text-accent-teal hover:bg-accent-teal/15',
    completedDot: 'bg-accent-teal/20',
    line: 'bg-accent-teal/25',
  },
  validation:  {
    active: 'bg-accent-orange text-white shadow-sm shadow-accent-orange/20',
    completed: 'bg-accent-orange/10 text-accent-orange hover:bg-accent-orange/15',
    completedDot: 'bg-accent-orange/20',
    line: 'bg-accent-orange/25',
  },
  forecast:    {
    active: 'bg-accent-purple text-white shadow-sm shadow-accent-purple/20',
    completed: 'bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/15',
    completedDot: 'bg-accent-purple/20',
    line: 'bg-accent-purple/25',
  },
  export:      {
    active: 'bg-green-500 text-white shadow-sm shadow-green-500/20',
    completed: 'bg-green-500/10 text-green-600 hover:bg-green-500/15',
    completedDot: 'bg-green-500/20',
    line: 'bg-green-500/25',
  },
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
        const colors = STEP_COLORS[step]

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            {/* Step chip */}
            <button
              onClick={() => enabled && setStep(step)}
              disabled={!enabled}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-all ${
                active
                  ? colors.active
                  : completed
                  ? `${colors.completed} cursor-pointer`
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
                    ? colors.completedDot
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

            {/* Connecting line — uses the color of the step it connects FROM */}
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mx-1 rounded-full transition-colors ${
                  completed ? colors.line : 'bg-secondary/10'
                }`}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}
