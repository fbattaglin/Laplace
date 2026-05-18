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
            <h2 className="text-2xl font-semibold text-primary mb-1">
              Understand your data. Find the best forecast.
            </h2>
            <p className="text-secondary">
              Load a dataset and Laplace will analyze its patterns, compare forecasting models, and predict future values — automatically.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-primary mb-1">
              Time Series Analysis & Forecasting
            </h2>
            <p className="text-secondary">
              Rolling-origin backtests · 5 models (Chronos-2, TimesFM, ETS, Theta, SeasonalNaive) · Probabilistic forecasts · Lab preprocessing
            </p>
          </>
        )}
      </div>

      <DatasetPicker />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-secondary/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-canvas px-4 text-sm text-secondary">or</span>
        </div>
      </div>

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
    </div>
  )
}
