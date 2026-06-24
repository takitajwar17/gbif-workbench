import { ScrollArea } from '@/components/ui/scroll-area'

export function ProseBlock({ content }: { content: string }) {
  const lineCount = content.split('\n').length
  const dynamicHeight = Math.min(560, Math.max(220, lineCount * 22 + 48))
  return (
    <ScrollArea className="rounded-lg border bg-card" style={{ height: dynamicHeight }}>
      <div className="p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">{content}</pre>
      </div>
    </ScrollArea>
  )
}