import type { ReactNode } from 'react'
import { CardDescription, CardTitle } from '@/components/ui/card'

export function SectionTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center self-start text-primary [&_svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex h-6 items-center">
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription className="mt-1 leading-5">{description}</CardDescription>
      </div>
    </div>
  )
}