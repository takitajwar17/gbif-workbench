import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { downloadBlob, withCharset } from '@/lib/format'

export function ExportButton({
  icon,
  label,
  filename,
  content,
  type = 'text/markdown',
}: {
  icon: ReactNode
  label: string
  filename: string
  content: string
  type?: string
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => downloadBlob(filename, new Blob([content], { type: withCharset(type) }))}>
      {icon}
      {label}
    </Button>
  )
}