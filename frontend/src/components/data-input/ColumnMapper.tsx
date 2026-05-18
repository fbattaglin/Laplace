import { useState } from 'react'

import { useConfirmUpload } from '../../hooks/useApi'
import { useAppStore } from '../../stores/useAppStore'
import type { UploadResponse } from '../../types'

const FREQUENCIES = [
  { value: '', label: 'Auto-detect' },
  { value: 'H', label: 'Hourly' },
  { value: 'D', label: 'Daily' },
  { value: 'W', label: 'Weekly' },
  { value: 'M', label: 'Monthly' },
  { value: 'Q', label: 'Quarterly' },
  { value: 'Y', label: 'Annual' },
]

interface Props {
  uploadResponse: UploadResponse
  file: File
}

export function ColumnMapper({ uploadResponse, file }: Props) {
  const { columns, detected } = uploadResponse
  const displayMode = useAppStore((s) => s.displayMode)
  const [datetimeCol, setDatetimeCol] = useState(detected.datetime_col || columns[0])
  const [targetCol, setTargetCol] = useState(detected.target_col || columns[1] || columns[0])
  const [frequency, setFrequency] = useState('')
  const [selectedCovariates, setSelectedCovariates] = useState<string[]>([])
  const confirm = useConfirmUpload()

  const numericColumns = columns.filter((col) => {
    const dtype = uploadResponse.dtypes[col]
    return dtype?.includes('int') || dtype?.includes('float')
  })

  // Covariate-eligible: numeric cols that aren't the target (Lab mode, >2 numeric cols)
  const covariateEligible = numericColumns.filter((col) => col !== targetCol)
  const showCovariateSelector = displayMode === 'lab' && covariateEligible.length >= 2

  function toggleCovariate(col: string) {
    setSelectedCovariates((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    )
  }

  const handleConfirm = () => {
    confirm.mutate({
      file,
      datetime_col: datetimeCol,
      target_col: targetCol,
      frequency: frequency || undefined,
      covariate_cols: selectedCovariates.length > 0 ? selectedCovariates : undefined,
    })
  }

  return (
    <div className="bg-surface rounded-xl p-6">
      <h3 className="font-medium text-primary mb-4">
        Confirm Columns — {file.name}
      </h3>

      {detected.confidence > 0.7 && (
        <p className="text-sm text-accent-blue mb-4">
          Columns auto-detected with high confidence.
        </p>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm text-secondary mb-1">Date/Time Column</label>
          <select
            value={datetimeCol}
            onChange={(e) => setDatetimeCol(e.target.value)}
            className="w-full px-3 py-2 border border-secondary/20 rounded-lg bg-canvas text-primary"
          >
            {columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-secondary mb-1">Target Column</label>
          <select
            value={targetCol}
            onChange={(e) => setTargetCol(e.target.value)}
            className="w-full px-3 py-2 border border-secondary/20 rounded-lg bg-canvas text-primary"
          >
            {(numericColumns.length > 0 ? numericColumns : columns).map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-secondary mb-1">Frequency</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full px-3 py-2 border border-secondary/20 rounded-lg bg-canvas text-primary"
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showCovariateSelector && (
        <div className="mb-6 p-4 bg-canvas rounded-xl border border-surface">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-medium text-secondary uppercase tracking-wide">
              Exogenous Variables
            </p>
            <span className="text-[9px] bg-[#8B5CF6] text-white px-1.5 py-0.5 rounded font-medium">
              LAB
            </span>
          </div>
          <p className="text-xs text-secondary/70 mb-3">
            Select additional numeric columns to use as covariates. They will be aligned with the
            target series and passed through the forecasting pipeline.
          </p>
          <div className="flex flex-wrap gap-2">
            {covariateEligible.map((col) => {
              const selected = selectedCovariates.includes(col)
              return (
                <button
                  key={col}
                  onClick={() => toggleCovariate(col)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    selected
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/5 text-[#8B5CF6] font-medium'
                      : 'border-primary/10 text-secondary hover:border-primary/20'
                  }`}
                >
                  {selected ? '✓ ' : ''}
                  {col}
                </button>
              )
            })}
          </div>
          {selectedCovariates.length > 0 && (
            <p className="text-[10px] text-secondary/50 mt-2">
              {selectedCovariates.length} covariate{selectedCovariates.length > 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={confirm.isPending || datetimeCol === targetCol}
        className="px-5 py-2.5 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 disabled:opacity-50 transition-colors"
      >
        {confirm.isPending ? 'Processing...' : 'Confirm & Continue'}
      </button>

      {confirm.isError && (
        <p className="mt-3 text-sm text-accent-red">{confirm.error.message}</p>
      )}
    </div>
  )
}
