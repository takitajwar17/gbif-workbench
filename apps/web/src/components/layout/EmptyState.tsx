export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 leading-6">{body}</p>
    </div>
  )
}