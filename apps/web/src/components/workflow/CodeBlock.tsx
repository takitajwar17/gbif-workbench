import { ScrollArea } from '@/components/ui/scroll-area'

// Code/prose block fills the parent column rather than fixed 360px so it
// grows with the right-hand triage column on tall viewports. The ScrollArea
// inside the code block handles overflow on smaller viewports.
export function CodeBlock({ content, language }: { content: string; language: string }) {
  const lineCount = content.split('\n').length
  const dynamicHeight = Math.min(560, Math.max(180, lineCount * 18 + 32))
  return (
    <ScrollArea className="rounded-lg border bg-neutral-950" style={{ height: dynamicHeight }}>
      <pre className="p-4 font-mono text-xs leading-6 text-neutral-50">
        <code data-language={language.toLowerCase()}>{content}</code>
      </pre>
    </ScrollArea>
  )
}