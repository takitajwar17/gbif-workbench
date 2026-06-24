export function RiskDetail({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <dt className="font-medium text-foreground">{title}</dt>
      <dd className="mt-0.5 leading-6 text-muted-foreground">{body}</dd>
    </div>
  )
}