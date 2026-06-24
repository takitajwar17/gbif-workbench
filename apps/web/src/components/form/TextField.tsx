import type { HTMLAttributes } from 'react'
import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  hint,
}: {
  id: string
  label: string
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  hint?: string
}) {
  const hintId = useId()
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-describedby={hint ? hintId : undefined}
      />
      {hint && (
        <p id={hintId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}