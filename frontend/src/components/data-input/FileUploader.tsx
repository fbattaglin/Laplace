import { useCallback, useState } from 'react'

import { useUploadFile } from '../../hooks/useApi'
import type { UploadResponse } from '../../types'

interface Props {
  onUploadComplete: (response: UploadResponse, file: File) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUploader({ onUploadComplete }: Props) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
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
        onSuccess: (response) => {
          setUploadedFile(file)
          onUploadComplete(response, file)
        },
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

      {uploadedFile ? (
        /* Success state */
        <div className="border border-accent-blue/30 bg-accent-blue/4 rounded-xl px-6 py-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent-blue/10 flex items-center justify-center shrink-0">
            <span className="text-accent-blue text-sm font-bold">✓</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary truncate">{uploadedFile.name}</p>
            <p className="text-xs text-secondary mt-0.5">{formatBytes(uploadedFile.size)} · Configure columns below</p>
          </div>
          <button
            onClick={() => {
              setUploadedFile(null)
              uploadMutation.reset()
            }}
            className="ml-auto text-xs text-secondary hover:text-primary transition-colors shrink-0"
          >
            Change file
          </button>
        </div>
      ) : (
        /* Drop zone */
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
              : 'border-accent-blue/20 bg-accent-blue/[0.02] hover:border-accent-blue/40 hover:bg-accent-blue/5'
          }`}
        >
          {uploadMutation.isPending ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-secondary">Parsing file...</p>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-accent-blue/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-sm font-medium text-primary mb-1">Drag & drop your CSV or XLSX here</p>
              <p className="text-xs text-secondary/60 mb-4">or</p>
              <label className="inline-block px-4 py-2 bg-accent-blue text-white rounded-lg cursor-pointer hover:bg-accent-blue/90 transition-colors text-sm font-medium">
                Browse files
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-secondary/50 mt-3">CSV, XLSX or XLS · max 10 MB</p>
            </>
          )}
        </div>
      )}

      {uploadMutation.isError && (
        <p className="mt-3 text-sm text-accent-red">{uploadMutation.error.message}</p>
      )}
    </div>
  )
}
