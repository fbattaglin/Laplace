import { useCallback, useState } from 'react'

import { useUploadFile } from '../../hooks/useApi'
import type { UploadResponse } from '../../types'

interface Props {
  onUploadComplete: (response: UploadResponse, file: File) => void
}

export function FileUploader({ onUploadComplete }: Props) {
  const [isDragOver, setIsDragOver] = useState(false)
  const uploadMutation = useUploadFile()

  const handleFile = useCallback(
    (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
        alert('Please upload a CSV or XLSX file.')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('File too large (max 10MB).')
        return
      }
      uploadMutation.mutate(file, {
        onSuccess: (response) => onUploadComplete(response, file),
      })
    },
    [uploadMutation, onUploadComplete]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  return (
    <div>
      <h3 className="text-sm font-medium text-secondary uppercase tracking-wide mb-3">
        Upload Your Data
      </h3>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
          isDragOver
            ? 'border-accent-blue bg-accent-blue/5'
            : 'border-secondary/20 hover:border-secondary/40'
        }`}
      >
        <p className="text-secondary mb-2">
          Drag & drop a CSV or XLSX file here
        </p>
        <p className="text-sm text-secondary/60 mb-4">or</p>
        <label className="inline-block px-4 py-2 bg-primary text-white rounded-lg cursor-pointer hover:bg-primary/90 transition-colors">
          Browse files
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleInputChange}
            className="hidden"
          />
        </label>
      </div>
      {uploadMutation.isPending && (
        <p className="mt-3 text-sm text-secondary">Parsing file...</p>
      )}
      {uploadMutation.isError && (
        <p className="mt-3 text-sm text-accent-red">
          {uploadMutation.error.message}
        </p>
      )}
    </div>
  )
}
