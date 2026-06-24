import { CheckCircle2, ClipboardList, Info, Loader2, Play, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/layout/SectionTitle'
import { SelectField } from '@/components/form/SelectField'
import { TextField } from '@/components/form/TextField'
import { ANALYSIS_OPTIONS } from '@/constants/options'
import { numberOrNull } from '@/lib/format'
import type { AnalysisType, StudyIntent, TaxonResolution } from '@/lib/types'

export function InterpretationPanel({
  intent,
  taxon,
  onChange,
  onCountriesChange,
  onRefresh,
  isBusy,
}: {
  intent: StudyIntent | null
  taxon: TaxonResolution | null
  onChange: (partial: Partial<StudyIntent>) => void
  onCountriesChange: (value: string) => void
  onRefresh: () => void
  isBusy: boolean
}) {
  if (!intent) return null

  const hasEdits =
    intent.ambiguities.length > 0 ||
    intent.taxonText.trim().length > 0 ||
    intent.regionText.trim().length > 0 ||
    intent.countries.length > 0 ||
    intent.startYear !== null ||
    intent.endYear !== null

  return (
    <Card>
      <CardHeader>
        <SectionTitle
          icon={<ClipboardList />}
          title="Interpreted scope"
          description="Review the Workbench's interpretation of your question before running or rerunning the live preview."
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs leading-5 text-muted-foreground">
          Edit any field to refine the scope. Click <strong>Run live preview</strong> to refetch GBIF data with the new filters.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <TextField
            id="intent-taxon"
            label="Taxon"
            value={intent.taxonText}
            onChange={(value) => onChange({ taxonText: value, taxonQuery: value })}
            placeholder="Scientific or common name"
          />
          <TextField id="intent-region" label="Region" value={intent.regionText} onChange={(value) => onChange({ regionText: value })} placeholder="Region name or free text" />
          <TextField
            id="intent-countries"
            label="Countries"
            value={intent.countries.join(', ')}
            onChange={onCountriesChange}
            placeholder="ISO codes, comma-separated (e.g. BR, AR)"
            hint="Use ISO 3166-1 alpha-2 codes: BR, US, FR. Case insensitive."
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField id="intent-start" label="Start year" value={intent.startYear ?? ''} onChange={(value) => onChange({ startYear: numberOrNull(value) })} inputMode="numeric" placeholder="1990" />
            <TextField id="intent-end" label="End year" value={intent.endYear ?? ''} onChange={(value) => onChange({ endYear: numberOrNull(value) })} inputMode="numeric" placeholder="2025" />
          </div>
          <SelectField id="intent-analysis" label="Analysis" value={intent.analysisType} onValueChange={(value) => onChange({ analysisType: value as AnalysisType })} options={ANALYSIS_OPTIONS} />
          <TextField id="intent-spatial" label="Spatial scale" value={intent.spatialResolution} onChange={(value) => onChange({ spatialResolution: value })} placeholder="Country, continent, etc." />
          <TextField id="intent-skill" label="Skill level" value={intent.skillLevel} onChange={(value) => onChange({ skillLevel: value })} placeholder="Beginner / intermediate / advanced" />
        </div>

        {taxon && (
          <Alert variant="success">
            <CheckCircle2 className="col-start-1 row-span-2 mt-0.5 size-4" />
            <AlertTitle>GBIF taxon match</AlertTitle>
            <AlertDescription>
              <p>
                <strong>{taxon.scientificName}</strong> ({taxon.rank}) · match confidence {taxon.confidence}
              </p>
              {taxon.alternatives.length > 0 && (
                <p className="mt-1 text-xs">
                  Alternatives considered: {taxon.alternatives.map((alt) => alt.scientificName).join(', ')}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {intent.ambiguities.length > 0 && (
          <Alert variant="warning">
            <Info className="col-start-1 row-span-2 mt-0.5 size-4" />
            <AlertTitle>Scope notes</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {intent.ambiguities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Button type="button" className="w-full" onClick={onRefresh} disabled={isBusy}>
          {isBusy ? <Loader2 className="animate-spin" /> : <Play />}
          {isBusy ? 'Running preview…' : 'Run live preview'}
        </Button>

        {hasEdits && !isBusy && (
          <p className="text-center text-xs text-muted-foreground">
            <RefreshCw className="mr-1 inline size-3" />
            Use the button above to refresh results with these scope changes.
          </p>
        )}
      </CardContent>
    </Card>
  )
}