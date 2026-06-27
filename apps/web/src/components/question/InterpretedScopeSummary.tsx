import { Check, ChevronDown, ChevronUp, Info, Loader2, Pencil, RefreshCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  formatAnalysisLabel,
  formatCountries,
  formatSkillLabel,
  formatSpatialLabel,
  formatYears,
} from '@/lib/format'
import {
  ANALYSIS_OPTIONS,
  SKILL_SELECT_OPTIONS,
  SPATIAL_SELECT_OPTIONS,
} from '@/constants/options'
import type { AnalysisType, PreferredLanguage, StudyIntent, TaxonResolution } from '@/lib/types'

// Inline editable summary of the interpreted scope.
//
// Each row has a compact label on the left and either a value or a
// control on the right. Three rows (Analysis, Spatial, Skill) and the
// Code output row render an always-editable Radix Select — picking an
// item commits immediately and sets scopeDirty = true. The four text
// rows (Taxon, Region, Countries, Years) keep the click-pencil pattern
// because their values are free-form and would otherwise blow up the
// row height.
//
// IMPORTANT: text row editors do NOT cancel on blur. The original
// implementation did, which killed Radix Select portals the moment they
// opened (Radix renders the dropdown in a portal outside this DOM tree,
// so focus leaving the row's wrapper fired onBlur and unmounted the
// trigger before the user could pick an item). Now editors stay open
// until the user explicitly commits (Enter, Done button) or cancels
// (Escape, Cancel button).

type TextRow = 'taxon' | 'region' | 'countries' | 'years'

// Strip non-digits from the year inputs. Hoisted to module scope because
// `parse()` runs on every keystroke into the year editor — building the
// regex inline would re-allocate on every character. The /g flag with
// `.replace` is safe here because we don't iterate match state ourselves
// (String.prototype.replace handles /g internally; it doesn't rely on
// regex.lastIndex).
// See: js-hoist-regexp in the Vercel React Best Practices.
const NON_DIGIT = /[^\d]/g

export function InterpretedScopeSummary({
  intent,
  taxon,
  preferredLanguage,
  isBusy,
  scopeDirty,
  onIntentFieldChange,
  onCountriesChange,
  onPreferredLanguageChange,
  onRerun,
}: {
  intent: StudyIntent
  taxon: TaxonResolution | null
  preferredLanguage: PreferredLanguage
  isBusy: boolean
  scopeDirty: boolean
  onIntentFieldChange: <K extends keyof StudyIntent>(key: K, value: StudyIntent[K]) => void
  onCountriesChange: (value: string) => void
  onPreferredLanguageChange: (value: PreferredLanguage) => void
  onRerun: () => void
}) {
  const [editing, setEditing] = useState<TextRow | null>(null)
  const [showAmbiguities, setShowAmbiguities] = useState(false)

  function cancel() {
    setEditing(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Interpreted scope</h3>
          {scopeDirty && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900">
              Edited. Press Re-run
            </span>
          )}
        </div>
        <Button
          type="button"
          variant={scopeDirty ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            cancel()
            onRerun()
          }}
          disabled={isBusy}
          aria-label="Re-run with current scope"
          className="h-7 px-2 text-xs"
        >
          {isBusy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          {scopeDirty ? 'Re-run to apply' : 'Re-run'}
        </Button>
      </div>

      <dl className="divide-y rounded-md border bg-muted/20 text-sm">
        <TextRow
          id="taxon"
          label="Taxon"
          value={
            intent.taxonText.trim()
              ? `${intent.taxonText}${intent.taxonomicRank ? ` (${intent.taxonomicRank})` : ''}`
              : 'Any taxon'
          }
          editing={editing === 'taxon'}
          onEdit={() => setEditing('taxon')}
          onCancel={cancel}
        >
          {(commit, cancelEdit) => (
            <InlineTextEditor
              id="scope-taxon"
              initialValue={intent.taxonText}
              placeholder="Scientific or common name"
              onCommit={(value) => {
                onIntentFieldChange('taxonText', value)
                commit()
              }}
              onCancel={cancelEdit}
            />
          )}
        </TextRow>

        <TextRow
          id="region"
          label="Region"
          value={intent.regionText.trim() || 'Worldwide'}
          editing={editing === 'region'}
          onEdit={() => setEditing('region')}
          onCancel={cancel}
        >
          {(commit, cancelEdit) => (
            <InlineTextEditor
              id="scope-region"
              initialValue={intent.regionText}
              placeholder="Region name or free text"
              onCommit={(value) => {
                onIntentFieldChange('regionText', value)
                commit()
              }}
              onCancel={cancelEdit}
            />
          )}
        </TextRow>

        <TextRow
          id="countries"
          label="Countries"
          value={formatCountries(intent.countries)}
          editing={editing === 'countries'}
          onEdit={() => setEditing('countries')}
          onCancel={cancel}
        >
          {(commit, cancelEdit) => (
            <InlineTextEditor
              id="scope-countries"
              initialValue={intent.countries.join(', ')}
              placeholder="ISO codes, e.g. BR, US, FR"
              onCommit={(value) => {
                onCountriesChange(value)
                commit()
              }}
              onCancel={cancelEdit}
            />
          )}
        </TextRow>

        <TextRow
          id="years"
          label="Years"
          value={formatYears(intent.startYear, intent.endYear)}
          editing={editing === 'years'}
          onEdit={() => setEditing('years')}
          onCancel={cancel}
        >
          {(commit, cancelEdit) => (
            <InlineYearsEditor
              start={intent.startYear}
              end={intent.endYear}
              onCommit={(start, end) => {
                onIntentFieldChange('startYear', start)
                onIntentFieldChange('endYear', end)
                commit()
              }}
              onCancel={cancelEdit}
            />
          )}
        </TextRow>

        <AlwaysSelectRow
          id="scope-analysis"
          label="Analysis"
          value={intent.analysisType}
          options={ANALYSIS_OPTIONS.filter((opt) => opt.value !== 'unknown')}
          placeholder="Auto-detected"
          matchesOption={matchesOption}
          formatLabel={formatAnalysisLabel}
          onChange={(next) => onIntentFieldChange('analysisType', next as AnalysisType)}
        />

        <AlwaysSelectRow
          id="scope-spatial"
          label="Spatial"
          value={intent.spatialResolution}
          options={SPATIAL_SELECT_OPTIONS}
          placeholder="Auto-detected"
          matchesOption={matchesOption}
          formatLabel={formatSpatialLabel}
          onChange={(next) => onIntentFieldChange('spatialResolution', next === 'infer' ? '' : next)}
        />

        <AlwaysSelectRow
          id="scope-skill"
          label="Skill"
          value={intent.skillLevel}
          options={SKILL_SELECT_OPTIONS}
          placeholder="Auto-detected"
          matchesOption={(value, options) => matchesOption(value, options, true)}
          formatLabel={formatSkillLabel}
          onChange={(next) => onIntentFieldChange('skillLevel', next === 'infer' ? '' : next)}
        />

        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Code output
          </span>
          <Select value={preferredLanguage} onValueChange={(value) => onPreferredLanguageChange(value as PreferredLanguage)}>
            <SelectTrigger id="scope-code" className="h-8 w-32" aria-label="Code output language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Both">Both</SelectItem>
              <SelectItem value="R">R</SelectItem>
              <SelectItem value="Python">Python</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">Affects all generated code.</span>
        </div>
      </dl>

      {intent.ambiguities.length > 0 && (
        <Alert variant="warning">
          <Info className="col-start-1 row-span-2 mt-0.5 size-4" />
          <AlertTitle>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left"
              onClick={() => setShowAmbiguities((value) => !value)}
              aria-expanded={showAmbiguities}
            >
              Scope notes ({intent.ambiguities.length})
              {showAmbiguities ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          </AlertTitle>
          {showAmbiguities && (
            <AlertDescription>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {intent.ambiguities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}

      {taxon && (
        <Alert variant="success">
          <Check className="col-start-1 row-span-2 mt-0.5 size-4" />
          <AlertTitle>GBIF taxon match</AlertTitle>
          <AlertDescription>
            <p>
              <strong>{taxon.scientificName}</strong> ({taxon.rank}) · match confidence {taxon.confidence}
            </p>
            {taxon.alternatives.length > 0 && (
              <p className="mt-1 text-xs">+{taxon.alternatives.length} alternative match{taxon.alternatives.length === 1 ? '' : 'es'} considered</p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// One labeled row in the scope summary that edits a free-text field.
// Pencil stays — the user did not ask to remove it for text rows.
function TextRow({
  id,
  label,
  value,
  editing,
  onEdit,
  onCancel,
  children,
}: {
  id: string
  label: string
  value: string
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  children: (commit: () => void, cancel: () => void) => React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start gap-2 px-3 py-2">
      <Label htmlFor={editing ? `scope-${id}` : undefined} className="w-24 shrink-0 pt-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {editing ? (
        <div className="min-w-0 flex-1">{children(onCancel, onCancel)}</div>
      ) : (
        <>
          <span className="min-w-0 flex-1 break-words text-sm text-foreground">{value}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onClick={onEdit}
            aria-label={`Edit ${label}`}
          >
            <Pencil className="size-3" />
          </Button>
        </>
      )}
    </div>
  )
}

// Always-editable dropdown row. Mirrors the Code output row: a compact
// label on the left, a Radix Select on the right. Picking an option
// commits immediately via onChange. The dropdown still shows the
// formatted current label even when the LLM returned a free-form value
// (we map back to "Infer automatically" so the user can opt into a
// canonical value).
function AlwaysSelectRow({
  id,
  label,
  value,
  options,
  placeholder,
  matchesOption,
  formatLabel,
  onChange,
}: {
  id: string
  label: string
  value: string | null | undefined
  options: { value: string; label: string }[]
  placeholder: string
  matchesOption: (
    value: string | null | undefined,
    options: { value: string; label: string }[],
  ) => boolean
  formatLabel: (value: string | null | undefined) => string
  onChange: (next: string) => void
}) {
  // Radix's <SelectValue> matches items case-sensitively. When the LLM
  // returns a value whose case differs from the option list (e.g.
  // "intermediate" vs the option "Intermediate"), we still want the
  // dropdown to display the canonical option. Find the option whose
  // value matches (case-insensitively when matchesOption says so) and
  // hand Radix the canonical case.
  const canonicalOption = value
    ? options.find((opt) => matchesOption(value, [opt]))
    : null
  const dropdownValue = canonicalOption ? canonicalOption.value : 'infer'
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <Label htmlFor={id} className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Select value={dropdownValue} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-8 w-full min-w-0 flex-1 text-sm" aria-label={`${label} (${formatLabel(value)})`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// Inline single-line text editor. Commits on Enter or on the checkmark
// button. Cancels on Escape or on the X button (closes the row without
// touching the parent's intent). Keeps an internal draft so the parent
// only sees the value once the user explicitly commits.
function InlineTextEditor({
  id,
  initialValue,
  placeholder,
  onCommit,
  onCancel,
}: {
  id: string
  initialValue: string
  placeholder: string
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function commit() {
    onCommit(draft.trim())
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
      <Button
        type="button"
        variant="default"
        size="icon"
        className="size-8 shrink-0"
        onClick={commit}
        aria-label={`Save ${placeholder}`}
      >
        <Check className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={onCancel}
        aria-label={`Cancel ${placeholder} edit`}
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}

// Two inline year inputs that commit together. Enter on either input
// commits both; Escape cancels and closes the row.
function InlineYearsEditor({
  start,
  end,
  onCommit,
  onCancel,
}: {
  start: number | null
  end: number | null
  onCommit: (start: number | null, end: number | null) => void
  onCancel: () => void
}) {
  const [startDraft, setStartDraft] = useState(start == null ? '' : String(start))
  const [endDraft, setEndDraft] = useState(end == null ? '' : String(end))

  function parse(value: string): number | null {
    const trimmed = value.replace(NON_DIGIT, '').slice(0, 4)
    if (!trimmed) return null
    const n = Number(trimmed)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  function commit() {
    onCommit(parse(startDraft), parse(endDraft))
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        id="scope-start-year"
        value={startDraft}
        onChange={(event) => setStartDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
        placeholder="Start"
        inputMode="numeric"
        autoFocus
        className="h-8 w-24 text-sm"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        id="scope-end-year"
        value={endDraft}
        onChange={(event) => setEndDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
        placeholder="End"
        inputMode="numeric"
        className="h-8 w-24 text-sm"
      />
      <Button
        type="button"
        variant="default"
        size="icon"
        className="size-8 shrink-0"
        onClick={commit}
        aria-label="Save years"
      >
        <Check className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={onCancel}
        aria-label="Cancel years edit"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}

// Case-sensitive (or case-insensitive) lookup of a free-form value against
// a dropdown option list. Used so we don't pre-select an option that
// doesn't exist (e.g. the LLM returned "Country-level and 10 km grid
// hotspot mapping" which doesn't match any SPATIAL_OPTIONS value).
function matchesOption(
  value: string | null | undefined,
  options: { value: string; label: string }[],
  caseInsensitive = false,
): boolean {
  if (!value) return false
  const norm = caseInsensitive ? value.trim().toLowerCase() : value
  return options.some((opt) => (caseInsensitive ? opt.value.toLowerCase() === norm : opt.value === value))
}