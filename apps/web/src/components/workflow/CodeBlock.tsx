import { ScrollArea } from '@/components/ui/scroll-area'

// Code/prose block fills the parent column rather than fixed 360px so it
// grows with the right-hand triage column on tall viewports. The ScrollArea
// inside the code block handles overflow on smaller viewports.
export function CodeBlock({ content, language }: { content: string; language: string }) {
  return (
    <ScrollArea className="min-h-[420px] flex-1 rounded-lg border bg-neutral-950">
      <pre className="p-4 font-mono text-xs leading-6 text-neutral-50">
        <code data-language={language.toLowerCase()}>{content}</code>
      </pre>
    </ScrollArea>
  )
}