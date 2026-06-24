import { useState } from 'react'
import { FileArchive, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createExportZip } from '@/lib/exportPackage'
import { downloadBlob } from '@/lib/format'
import type { GbifQuery, WorkflowPackage } from '@/lib/types'

export function ZipButton({ workflow, query }: { workflow: WorkflowPackage; query: GbifQuery }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="default"
        size="sm"
        className="w-auto"
        disabled={loading}
        aria-busy={loading}
        onClick={async () => {
          setLoading(true)
          setError('')
          try {
            const blob = await createExportZip(workflow, query)
            downloadBlob('gbif-workbench-export.zip', blob)
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not create ZIP export.')
          } finally {
            setLoading(false)
          }
        }}
      >
        {loading ? <Loader2 className="animate-spin" /> : <FileArchive />}
        {loading ? 'Bundling files…' : 'Download everything (.zip)'}
      </Button>
      {error && (
        <p className="text-xs leading-5 text-destructive" role="alert">
          ZIP export failed: {error}
        </p>
      )}
    </div>
  )
}