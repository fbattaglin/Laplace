import type { UploadResponse } from '../../types'

interface Props {
  data: UploadResponse
}

export function DataPreview({ data }: Props) {
  const { columns, preview_rows, n_rows } = data

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-secondary uppercase tracking-wide">
          Preview
        </h3>
        <span className="text-xs text-secondary">
          Showing {Math.min(preview_rows.length, 20)} of {n_rows} rows
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-secondary/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 text-left font-medium text-secondary"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview_rows.slice(0, 20).map((row, i) => (
              <tr key={i} className="border-t border-secondary/5">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-1.5 text-primary">
                    {row[col] != null ? String(row[col]) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
