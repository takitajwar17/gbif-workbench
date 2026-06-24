import type { HTMLAttributes } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  id: string
  label: string
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}