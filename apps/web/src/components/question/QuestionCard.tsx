import { ClipboardList, Loader2, Search, SlidersHorizontal } from 'lucide-react'
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
  onQuestionChange,
  onDemoSelect,
  onTaxonChange,
  onRegionChange,
  onYearsChange,
  onAnalysisChange,
  onSpatialResolutionChange,
  onSkillLevelChange,
  onPreferredLanguageChange,
  onInterpret,
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
  onQuestionChange: (value: string) => void
  onDemoSelect: (prompt: string) => void
  onTaxonChange: (value: string) => void
  onRegionChange: (value: string) => void
  onYearsChange: (value: string) => void
  onAnalysisChange: (value: AnalysisType) => void
  onSpatialResolutionChange: (value: string) => void
  onSkillLevelChange: (value: string) => void
  onPreferredLanguageChange: (value: PreferredLanguage) => void
  onInterpret: () => void
  onAnalyze: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={<Search />} title="Study idea" description="Start with a research question, then refine the scope." />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="question">Research question</Label>
          <Textarea
            id="question"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            rows={7}
            spellCheck
            placeholder="Describe the taxon, place, time period, and analysis you want to run."
            className="min-h-32 resize-y"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <Button type="button" onClick={onAnalyze} disabled={isBusy || !question.trim()}>
            {isBusy ? <Loader2 className="animate-spin" /> : <Search />}
            Analyze study idea
          </Button>
          <Button type="button" variant="secondary" onClick={onInterpret} disabled={isBusy || !question.trim()}>
            {isBusy ? <Loader2 className="animate-spin" /> : <ClipboardList />}
            Interpret scope
          </Button>
        </div>

        <div className="grid gap-2" aria-label="Example research prompts">
          {DEMO_PROMPTS.map((prompt) => (
            <Button key={prompt.question} type="button" variant="outline" className="h-auto justify-start whitespace-normal p-3 text-left" onClick={() => onDemoSelect(prompt.question)} disabled={isBusy}>
              <span>
                <span className="block text-sm font-medium">{prompt.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{prompt.question}</span>
              </span>
            </Button>
          ))}
        </div>

        <details className="group rounded-lg border bg-muted/25 p-3 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              Optional scope controls
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
            <span className="hidden text-xs text-muted-foreground group-open:inline">Hide</span>
          </summary>
          <Separator className="my-3" />
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