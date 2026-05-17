import { useState } from 'react'

import { useAppStore } from '../../stores/useAppStore'
import { t } from '../../lib/copy'
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
      <div>
        <h2 className="text-2xl font-semibold text-primary mb-2">
          {t('steps.dataInput', displayMode)}
        </h2>
        <p className="text-secondary">
          {displayMode === 'boardroom'
            ? 'Choose a sample dataset or upload your own time series data to get started.'
            : 'Select a preloaded reference dataset or upload CSV/XLSX. Datetime and target columns are auto-detected.'}
        </p>
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
