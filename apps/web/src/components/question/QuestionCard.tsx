import { ClipboardList, Loader2, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { SectionTitle } from '@/components/layout/SectionTitle'
import { SelectField } from '@/components/form/SelectField'
import { TextField } from '@/components/form/TextField'
import { DEMO_PROMPTS } from '@/constants/demoPrompts'
import { ANALYSIS_OPTIONS, CODE_OPTIONS, SKILL_SELECT_OPTIONS, SPATIAL_SELECT_OPTIONS } from '@/constants/options'
import type { AnalysisType, PreferredLanguage } from '@/lib/types'

export function QuestionCard({
  question,
  draftTaxon,
  draftRegion,
  draftYears,
  draftAnalysis,
  draftSpatialResolution,
  draftSkillLevel,
  preferredLanguage,
  isBusy,
  hasStaleResults,
  onClearResults,
  onQuestionChange,
  onDemoSelect,
  onTaxonChange,
  onRegionChange,
  onYearsChange,
  onAnalysisChange,
  onSpatialResolutionChange,
  onSkillLevelChange,
  onPreferredLanguageChange,
  onAnalyze,
}: {
  question: string
  draftTaxon: string
  draftRegion: string
  draftYears: string
  draftAnalysis: AnalysisType
  draftSpatialResolution: string
  draftSkillLevel: string
  preferredLanguage: PreferredLanguage
  isBusy: boolean
  hasStaleResults: boolean
  onClearResults: () => void
  onQuestionChange: (value: string) => void
  onDemoSelect: (prompt: string) => void
  onTaxonChange: (value: string) => void
  onRegionChange: (value: string) => void
  onYearsChange: (value: string) => void
  onAnalysisChange: (value: AnalysisType) => void
  onSpatialResolutionChange: (value: string) => void
  onSkillLevelChange: (value: string) => void
  onPreferredLanguageChange: (value: PreferredLanguage) => void
  onAnalyze: () => void
}) {
  const canAnalyze = question.trim().length > 0
  const charCount = question.length
  const charHint = useMemo(() => {
    if (!charCount) return 'Aim for one or two sentences with the taxon, place, time window, and analysis you want.'
    if (charCount < 40) return 'Try adding more context — a place, time window, and analysis type help the most.'
    if (charCount > 600) return 'Long questions are fine, but the model focuses best on the first few sentences.'
    return 'Looks good. Click Analyze to fetch GBIF data.'
  }, [charCount])

  return (
    <Card>
      <CardHeader>
        <SectionTitle
          icon={<Search />}
          title="Describe your study"
          description="Write a research question. The Workbench will interpret scope, fetch live GBIF data, and generate code and write-ups."
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="question">Research question</Label>
            {question.length > 0 && (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {charCount} characters
              </span>
            )}
          </div>
          <Textarea
            id="question"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            rows={6}
            spellCheck
            placeholder="Example: Are kingfisher populations shifting northward in Europe since 2000?"
            className="min-h-28 resize-y"
            aria-describedby="question-hint"
          />
          <p id="question-hint" className="text-xs leading-5 text-muted-foreground">
            {charHint}
          </p>
        </div>

        <Button type="button" onClick={onAnalyze} disabled={isBusy || !canAnalyze} className="w-full" size="lg">
          {isBusy ? <Loader2 className="animate-spin" /> : <Search />}
          {isBusy ? 'Analyzing…' : 'Analyze study'}
        </Button>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Or start from an example</p>
            {hasStaleResults && (
              <Button type="button" variant="ghost" size="sm" onClick={onClearResults} className="h-7 px-2 text-xs">
                <Trash2 className="size-3.5" /> Clear current results
              </Button>
            )}
          </div>
          <div className="grid gap-2" aria-label="Example research prompts">
            {DEMO_PROMPTS.map((prompt) => (
              <Button
                key={prompt.question}
                type="button"
                variant="outline"
                className="h-auto justify-start whitespace-normal p-3 text-left"
                onClick={() => onDemoSelect(prompt.question)}
                disabled={isBusy}
                aria-label={`Use example: ${prompt.label} — ${prompt.question}`}
              >
                <span className="flex w-full items-start gap-2">
                  <ClipboardList className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{prompt.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{prompt.question}</span>
                  </span>
                </span>
              </Button>
            ))}
          </div>
        </div>

        {hasStaleResults && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <strong>Results will refresh automatically.</strong> Editing the question above clears the previous preview, triage, and exports so the new question can be analyzed cleanly.
          </div>
        )}

        <details className="group rounded-lg border bg-muted/25 p-3 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
              Override the interpretation
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">
              <X className="hidden" aria-hidden="true" /> Show
            </span>
            <span className="hidden text-xs text-muted-foreground group-open:inline">Hide</span>
          </summary>
          <Separator className="my-3" />
          <p className="mb-3 text-xs leading-5 text-muted-foreground">
            These override the Workbench's interpretation. Leave them empty to let the model infer.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <TextField id="draft-taxon" label="Taxon" value={draftTaxon} onChange={onTaxonChange} placeholder="Optional taxon override" />
            <TextField id="draft-region" label="Region" value={draftRegion} onChange={onRegionChange} placeholder="Optional region override" />
            <TextField id="draft-years" label="Years" value={draftYears} onChange={onYearsChange} placeholder="YYYY-YYYY" />
            <SelectField id="draft-analysis" label="Analysis" value={draftAnalysis} onValueChange={(value) => onAnalysisChange(value as AnalysisType)} options={ANALYSIS_OPTIONS} />
            <SelectField
              id="draft-spatial-scale"
              label="Spatial scale"
              value={draftSpatialResolution || 'infer'}
              onValueChange={(value) => onSpatialResolutionChange(value === 'infer' ? '' : value)}
              options={SPATIAL_SELECT_OPTIONS}
            />
            <SelectField
              id="draft-skill-level"
              label="Skill level"
              value={draftSkillLevel || 'infer'}
              onValueChange={(value) => onSkillLevelChange(value === 'infer' ? '' : value)}
              options={SKILL_SELECT_OPTIONS}
            />
            <SelectField
              id="draft-code-output"
              label="Code output"
              value={preferredLanguage}
              onValueChange={(value) => onPreferredLanguageChange(value as PreferredLanguage)}
              options={CODE_OPTIONS.map((value) => ({ value, label: value }))}
            />
          </div>
        </details>
      </CardContent>
    </Card>
  )
}