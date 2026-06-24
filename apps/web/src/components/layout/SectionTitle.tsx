import type { ReactNode } from 'react'
import { CardDescription, CardTitle } from '@/components/ui/card'

export function SectionTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-primary [&_svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="mt-1 leading-5">{description}</CardDescription>
      </div>
    </div>
  )
}