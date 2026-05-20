import { useState } from 'react'

import { useAppStore } from '../../stores/useAppStore'
import type { UploadResponse } from '../../types'
import { DatasetPicker } from './DatasetPicker'
import { FileUploader } from './FileUploader'
import { ColumnMapper } from './ColumnMapper'
import { DataPreview } from './DataPreview'

export function DataInputScreen() {
  const { displayMode } = useAppStore()
  const [uploadResult, setUploadResult] = useState<{
    response: UploadResponse
    file: File
  } | null>(null)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero / value proposition */}
      <div className="pb-2">
        {displayMode === 'boardroom' ? (
          <>
            <h2 className="text-2xl font-semibold text-primary mb-2">
              Not every signal can be predicted. Let's find out if yours can.
            </h2>
            <p className="text-secondary leading-relaxed">
              Laplace assesses whether your data is worth forecasting before a single model runs.
              Then it benchmarks five models in rolling cross-validation and delivers the best forecast — with honest confidence intervals.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-primary mb-2">
              Measure the signal before you model the noise.
            </h2>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {[
                { label: 'Forecastability score', color: 'bg-accent-teal/10 text-accent-teal' },
                { label: 'STL decomposition', color: 'bg-accent-blue/10 text-accent-blue' },
                { label: 'ACF / PACF', color: 'bg-accent-orange/10 text-accent-orange' },
                { label: 'Rolling-origin CV', color: 'bg-accent-purple/10 text-accent-purple' },
                { label: '5 models', color: 'bg-accent-purple/10 text-accent-purple' },
                { label: 'Ensemble', color: 'bg-accent-purple/10 text-accent-purple' },
                { label: 'Prediction intervals', color: 'bg-accent-teal/10 text-accent-teal' },
                { label: 'Data preprocessing', color: 'bg-surface text-secondary' },
              ].map(({ label, color }) => (
                <span key={label} className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
                  {label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Primary: Upload your own data */}
      <FileUploader
        onUploadComplete={(response, file) =>
          setUploadResult({ response, file })
        }
      />

      {uploadResult && (
        <>
          <DataPreview data={uploadResult.response} />
          <ColumnMapper
            uploadResponse={uploadResult.response}
            file={uploadResult.file}
          />
        </>
      )}

      {/* Secondary: explore preloaded datasets */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-secondary/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-canvas px-4 text-sm text-secondary">
            or explore a preloaded dataset
          </span>
        </div>
      </div>

      <DatasetPicker />
    </div>
  )
}
