import { CheckCircle2, ClipboardList, Info, Loader2, RefreshCw } from 'lucide-react'
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

  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={<ClipboardList />} title="Interpreted scope" description="Review the fields before running or rerunning the live preview." />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <TextField
            id="intent-taxon"
            label="Taxon"
            value={intent.taxonText}
            onChange={(value) => onChange({ taxonText: value, taxonQuery: value })}
          />
          <TextField id="intent-region" label="Region" value={intent.regionText} onChange={(value) => onChange({ regionText: value })} />
          <TextField id="intent-countries" label="Countries" value={intent.countries.join(', ')} onChange={onCountriesChange} placeholder="ISO country codes" />
          <div className="grid grid-cols-2 gap-3">
            <TextField id="intent-start" label="Start" value={intent.startYear ?? ''} onChange={(value) => onChange({ startYear: numberOrNull(value) })} inputMode="numeric" />
            <TextField id="intent-end" label="End" value={intent.endYear ?? ''} onChange={(value) => onChange({ endYear: numberOrNull(value) })} inputMode="numeric" />
          </div>
          <SelectField id="intent-analysis" label="Analysis" value={intent.analysisType} onValueChange={(value) => onChange({ analysisType: value as AnalysisType })} options={ANALYSIS_OPTIONS} />
          <TextField id="intent-spatial" label="Spatial scale" value={intent.spatialResolution} onChange={(value) => onChange({ spatialResolution: value })} />
          <TextField id="intent-skill" label="Skill level" value={intent.skillLevel} onChange={(value) => onChange({ skillLevel: value })} />
        </div>

        {taxon && (
          <Alert variant="success">
            <CheckCircle2 className="col-start-1 row-span-2 mt-0.5 size-4" />
            <AlertTitle>GBIF taxon match</AlertTitle>
            <AlertDescription>
              {taxon.scientificName} · {taxon.rank} · confidence {taxon.confidence}
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

        <Button type="button" variant="secondary" className="w-full" onClick={onRefresh} disabled={isBusy}>
          {isBusy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Run live preview
        </Button>
      </CardContent>
    </Card>
  )
}