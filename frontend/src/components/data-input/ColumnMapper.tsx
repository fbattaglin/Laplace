import { useState } from 'react'

import { useConfirmDataset } from '../../hooks/useApi'
import type { UploadResponse } from '../../types'

interface Props {
  uploadResponse: UploadResponse
  fileName: string
}

export function ColumnMapper({ uploadResponse, fileName }: Props) {
  const { columns, detected } = uploadResponse
  const [datetimeCol, setDatetimeCol] = useState(detected.datetime_col || columns[0])
  const [targetCol, setTargetCol] = useState(detected.target_col || columns[1] || columns[0])
  const confirm = useConfirmDataset()

  const numericColumns = columns.filter((col) => {
    const dtype = uploadResponse.dtypes[col]
    return dtype?.includes('int') || dtype?.includes('float')
  })

  const handleConfirm = () => {
    confirm.mutate({
      source: 'upload',
      datetime_col: datetimeCol,
      target_col: targetCol,
    })
  }

  return (
    <div className="bg-surface rounded-xl p-6">
      <h3 className="font-medium text-primary mb-4">
        Confirm Columns — {fileName}
      </h3>

      {detected.confidence > 0.7 && (
        <p className="text-sm text-accent-blue mb-4">
          Columns auto-detected with high confidence.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
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
      </div>

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
