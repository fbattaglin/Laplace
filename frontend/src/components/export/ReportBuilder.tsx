interface Section {
  id: string
  label: string
  description: string
}

const SECTIONS: Section[] = [
  { id: 'summary', label: 'Summary & KPIs', description: 'Dataset info, forecastability score, best model' },
  { id: 'backtest', label: 'Model Comparison', description: 'Rolling-origin backtest metrics for all models' },
  { id: 'forecast', label: 'Forecast Results', description: 'Point forecast and prediction intervals' },
  { id: 'diagnostics', label: 'Diagnostics', description: 'Forecastability dimensions and scores' },
  { id: 'raw_data', label: 'Raw Data', description: 'Original time series values' },
  { id: 'notes', label: 'Analyst Notes', description: 'Your notes (requires text below)' },
]

interface Props {
  selectedSections: Set<string>
  onToggleSection: (id: string) => void
  notes: string
  onNotesChange: (notes: string) => void
}

export function ReportBuilder({ selectedSections, onToggleSection, notes, onNotesChange }: Props) {
  return (
    <div className="bg-surface rounded-xl p-6 space-y-5">
      <h3 className="font-medium text-primary">Report Builder</h3>

      <div>
        <p className="text-xs text-secondary uppercase tracking-wide mb-3">Sections to include</p>
        <div className="space-y-2">
          {SECTIONS.map((section) => {
            const checked = selectedSections.has(section.id)
            return (
              <label
                key={section.id}
                className="flex items-start gap-3 cursor-pointer group"
              >
                <div className="mt-0.5 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleSection(section.id)}
                    className="w-4 h-4 accent-accent-blue cursor-pointer"
                  />
                </div>
                <div>
                  <p className={`text-sm font-medium transition-colors ${checked ? 'text-primary' : 'text-secondary'}`}>
                    {section.label}
                  </p>
                  <p className="text-xs text-secondary">{section.description}</p>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-xs text-secondary uppercase tracking-wide mb-2">Analyst Notes</p>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add context, caveats, or recommendations to include in the report..."
          rows={4}
          className="w-full text-sm bg-canvas border border-surface rounded-lg px-3 py-2 text-primary placeholder:text-secondary/50 resize-none focus:outline-none focus:ring-2 focus:ring-accent-blue/30"
        />
      </div>
    </div>
  )
}
