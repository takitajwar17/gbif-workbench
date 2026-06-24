import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { writeClipboard } from '@/lib/format'

export function CopyButton({ content, label }: { content: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await writeClipboard(content)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1400)
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? 'Copied' : label}
    </Button>
  )
}