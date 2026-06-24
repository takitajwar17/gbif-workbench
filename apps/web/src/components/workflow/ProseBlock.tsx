import { ScrollArea } from '@/components/ui/scroll-area'

export function ProseBlock({ content }: { content: string }) {
  return (
    <ScrollArea className="min-h-[420px] flex-1 rounded-lg border bg-card">
      <div className="p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">{content}</pre>
      </div>
    </ScrollArea>
  )
}