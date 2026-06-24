import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  ClipboardList,
  Code2,
  Database,
  ExternalLink,
  FileArchive,
  FileJson,
  FileText,
  Info,
  Loader2,
  Map,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { createExportZip, createJupyterNotebook, createQuartoNotebook } from './lib/exportPackage'
import { countryLabel, parseCountryList } from './lib/regions'
import type {
  AnalysisType,
  CountBucket,
  DataPreview,
  GbifQuery,
  OccurrencePoint,
  PreferredLanguage,
  Risk,
  StudyIntent,
  TaxonResolution,
  TriageResult,
  WorkflowPackage,
} from './lib/types'

type WorkflowTab = 'r' | 'python' | 'sql' | 'predicate' | 'cleaning' | 'methods' | 'citation' | 'limitations'
type Status = 'idle' | 'interpreting' | 'previewing' | 'ready' | 'error'

const ANALYSIS_OPTIONS: { value: AnalysisType; label: string }[] = [
  { value: 'unknown', label: 'Infer automatically' },
  { value: 'range_shift_exploration', label: 'Range-shift exploration' },
  { value: 'species_distribution_modelling', label: 'Species distribution modelling' },
  { value: 'distribution_mapping', label: 'Distribution mapping' },
  { value: 'temporal_trend_or_abundance', label: 'Trend / abundance triage' },
  { value: 'invasive_monitoring_preview', label: 'Invasive monitoring preview' },
]

const SPATIAL_OPTIONS = ['Local / fine-scale', 'Country or regional', 'Continental or broad-scale']
const SKILL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced']
const CODE_OPTIONS: PreferredLanguage[] = ['Both', 'R', 'Python']

const DEMO_PROMPTS = [
  {
    label: 'Range shifts',
    question: 'I want to study climate-driven range shifts of kingfishers in Southeast Asia from 1990 to 2025.',
  },
  {
    label: 'Population decline',
    question: 'Can GBIF show whether frog populations are declining in Bangladesh since 2000?',
  },
  {
    label: 'Distribution model',
    question: 'Can GBIF-mediated occurrence records support a species distribution model for Panthera leo in Africa?',
  },
]

interface StudyPlanResponse {
  intent: StudyIntent
  taxon: TaxonResolution
  query: GbifQuery
  preview: DataPreview
  triage: TriageResult
  workflow: WorkflowPackage
}

interface StudyPlanRequest {
  question: string
  overrides: Record<string, unknown>
}

interface IntentResponse {
  intent: StudyIntent
}

function App() {
  const [question, setQuestion] = useState('')
  const [draftTaxon, setDraftTaxon] = useState('')
  const [draftRegion, setDraftRegion] = useState('')
  const [draftYears, setDraftYears] = useState('')
  const [draftAnalysis, setDraftAnalysis] = useState<AnalysisType>('unknown')
  const [draftSpatialResolution, setDraftSpatialResolution] = useState('')
  const [draftSkillLevel, setDraftSkillLevel] = useState('')
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>('Both')
  const [intent, setIntent] = useState<StudyIntent | null>(null)
  const [taxon, setTaxon] = useState<TaxonResolution | null>(null)
  const [query, setQuery] = useState<GbifQuery | null>(null)
  const [preview, setPreview] = useState<DataPreview | null>(null)
  const [triage, setTriage] = useState<TriageResult | null>(null)
  const [workflow, setWorkflow] = useState<WorkflowPackage | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<WorkflowTab>('r')

  const isBusy = status === 'interpreting' || status === 'previewing'
  const topRisk = triage?.risks.find((risk) => risk.level === 'BLOCKING' || risk.level === 'HIGH')

  async function interpretScope() {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) return

    setError('')
    setStatus('interpreting')
    setTaxon(null)
    setPreview(null)
    setTriage(null)
    setWorkflow(null)

    try {
      const result = await requestStudyIntent({
        question: trimmedQuestion,
        overrides: buildDraftOverrides(),
      })
      setIntent(result.intent)
      setStatus('idle')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'GBIF Workbench interpretation failed.'
      setError(`${message} No scope interpretation was generated.`)
      setStatus('error')
    }
  }

  async function analyze() {
    await runStudy({
      question,
      overrides: intent ? { ...intent, preferredLanguage } : buildDraftOverrides(),
    })
  }

  async function rerunEditedScope(nextIntent = intent) {
    if (!nextIntent) return
    await runStudy({
      question: nextIntent.question || question,
      overrides: { ...nextIntent, preferredLanguage },
    })
  }

  async function runStudy(payload: StudyPlanRequest) {
    const trimmedQuestion = payload.question.trim()
    if (!trimmedQuestion) return

    setError('')
    setStatus('previewing')
    setTaxon(null)
    setPreview(null)
    setTriage(null)
    setWorkflow(null)

    try {
      const result = await requestStudyPlan({ ...payload, question: trimmedQuestion })
      setIntent(result.intent)
      setTaxon(result.taxon)
      setQuery(result.query)
      setPreview(result.preview)
      setTriage(result.triage)
      setWorkflow(result.workflow)
      setStatus('ready')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'GBIF Workbench analysis failed.'
      setError(`${message} No research plan was generated.`)
      setStatus('error')
    }
  }

  function buildDraftOverrides() {
    const years = parseYearRange(draftYears)
    const overrides: Record<string, unknown> = { preferredLanguage }
    if (draftTaxon.trim()) {
      overrides.taxonText = draftTaxon.trim()
      overrides.taxonQuery = draftTaxon.trim()
    }
    if (draftRegion.trim()) overrides.regionText = draftRegion.trim()
    if (years) {
      overrides.startYear = years.start
      overrides.endYear = years.end
    }
    if (draftAnalysis !== 'unknown') overrides.analysisType = draftAnalysis
    if (draftSpatialResolution) overrides.spatialResolution = draftSpatialResolution
    if (draftSkillLevel) overrides.skillLevel = draftSkillLevel
    return overrides
  }

  function selectDemoPrompt(prompt: string) {
    setQuestion(prompt)
    setDraftTaxon('')
    setDraftRegion('')
    setDraftYears('')
    setDraftAnalysis('unknown')
    setDraftSpatialResolution('')
    setDraftSkillLevel('')
    setPreferredLanguage('Both')
    clearResults()
  }

  function clearResults() {
    setIntent(null)
    setTaxon(null)
    setQuery(null)
    setPreview(null)
    setTriage(null)
    setWorkflow(null)
    setError('')
    setStatus('idle')
  }

  function changeQuestion(value: string) {
    setQuestion(value)
    if (intent || taxon || preview || triage || workflow || error) clearResults()
  }

  function updateIntent(partial: Partial<StudyIntent>) {
    setIntent((current) => (current ? { ...current, ...partial } : current))
  }

  function updateCountries(value: string) {
    setIntent((current) => (current ? { ...current, countries: parseCountryList(value) } : current))
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1760px] items-center justify-between gap-3 px-4 lg:px-6">
          <a className="flex min-w-0 items-center gap-3 text-foreground no-underline" href="#workspace" aria-label="GBIF Workbench workspace">
            <span className="min-w-0">
              <strong className="block truncate text-sm font-semibold">GBIF Workbench</strong>
              <span className="block truncate text-xs text-muted-foreground">Pre-download research triage</span>
            </span>
          </a>
          <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex" aria-label="Primary navigation">
            <Button variant="ghost" size="sm" asChild>
              <a href="#workspace">Workspace</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="#method">Method</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="#exports">Exports</a>
            </Button>
          </nav>
          <Button type="button" onClick={analyze} disabled={isBusy || !question.trim()} size="sm">
            {isBusy ? <Loader2 className="animate-spin" /> : <Play />}
            Start plan
          </Button>
        </div>
      </header>

      <main id="workspace" className="mx-auto flex w-full max-w-[1760px] flex-col px-4 py-4 lg:px-6 xl:h-[calc(100vh-4rem)] xl:overflow-hidden" aria-busy={isBusy}>
        <section className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] xl:shrink-0">
          <div className="space-y-2">
            <h1 className="max-w-4xl text-2xl font-semibold tracking-normal text-foreground md:text-3xl">
              Scope a GBIF study before downloading data.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              Turn a biodiversity research question into GBIF filters, live availability checks, claim triage, and reproducible workflow exports.
            </p>
          </div>
          <StatusCard status={status} preview={preview} topRisk={topRisk} />
        </section>

        <section className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[390px_minmax(0,1fr)]">
          <div
            data-pane="scope"
            aria-label="Study scope controls"
            tabIndex={0}
            className="space-y-4 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pb-4 xl:pr-2"
          >
            <StudyIdeaCard
              question={question}
              draftTaxon={draftTaxon}
              draftRegion={draftRegion}
              draftYears={draftYears}
              draftAnalysis={draftAnalysis}
              draftSpatialResolution={draftSpatialResolution}
              draftSkillLevel={draftSkillLevel}
              preferredLanguage={preferredLanguage}
              isBusy={isBusy}
              onQuestionChange={changeQuestion}
              onDemoSelect={selectDemoPrompt}
              onTaxonChange={setDraftTaxon}
              onRegionChange={setDraftRegion}
              onYearsChange={setDraftYears}
              onAnalysisChange={setDraftAnalysis}
              onSpatialResolutionChange={setDraftSpatialResolution}
              onSkillLevelChange={setDraftSkillLevel}
              onPreferredLanguageChange={setPreferredLanguage}
              onInterpret={interpretScope}
              onAnalyze={analyze}
            />

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="col-start-1 row-span-2 mt-0.5 size-4" />
                <AlertTitle>Analysis failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <InterpretationPanel
              intent={intent}
              taxon={taxon}
              onChange={updateIntent}
              onCountriesChange={updateCountries}
              onRefresh={() => rerunEditedScope()}
              isBusy={isBusy}
            />
          </div>

          <div
            data-pane="results"
            aria-label="Results and generated workflow"
            tabIndex={0}
            className="grid min-w-0 gap-4 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pb-4 xl:pr-2 2xl:grid-cols-[minmax(0,1.05fr)_minmax(430px,0.95fr)]"
          >
            <DataPreviewSection preview={preview} />
            <TriageSection
              triage={triage}
              preview={preview}
              workflow={workflow}
              query={query}
              activeWorkflowTab={activeWorkflowTab}
              onWorkflowTabChange={setActiveWorkflowTab}
            />
            <MethodSection />
          </div>
        </section>
      </main>
    </div>
  )
}

async function requestStudyPlan(payload: StudyPlanRequest): Promise<StudyPlanResponse> {
  const response = await fetch('/api/study-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `GBIF Workbench API failed with status ${response.status}`)
  }

  return (await response.json()) as StudyPlanResponse
}

async function requestStudyIntent(payload: StudyPlanRequest): Promise<IntentResponse> {
  const response = await fetch('/api/parse-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `GBIF Workbench API failed with status ${response.status}`)
  }

  return (await response.json()) as IntentResponse
}

function StudyIdeaCard({
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
            className="min-h-36 resize-y"
          />
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

        <Separator />

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
            options={[{ value: 'infer', label: 'Infer automatically' }, ...SPATIAL_OPTIONS.map((value) => ({ value, label: value }))]}
          />
          <SelectField
            id="draft-skill-level"
            label="Skill level"
            value={draftSkillLevel || 'infer'}
            onValueChange={(value) => onSkillLevelChange(value === 'infer' ? '' : value)}
            options={[{ value: 'infer', label: 'Infer automatically' }, ...SKILL_OPTIONS.map((value) => ({ value, label: value }))]}
          />
          <SelectField
            id="draft-code-output"
            label="Code output"
            value={preferredLanguage}
            onValueChange={(value) => onPreferredLanguageChange(value as PreferredLanguage)}
            options={CODE_OPTIONS.map((value) => ({ value, label: value }))}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <Button type="button" variant="secondary" onClick={onInterpret} disabled={isBusy || !question.trim()}>
            {isBusy ? <Loader2 className="animate-spin" /> : <ClipboardList />}
            Interpret scope
          </Button>
          <Button type="button" onClick={onAnalyze} disabled={isBusy || !question.trim()}>
            {isBusy ? <Loader2 className="animate-spin" /> : <Search />}
            Analyze study idea
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function InterpretationPanel({
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

function DataPreviewSection({ preview }: { preview: DataPreview | null }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <SectionTitle icon={<Database />} title="GBIF data preview" description="Aggregated search facets from the current scope." />
      </CardHeader>
      <CardContent>{preview ? <DataPreviewPanel preview={preview} /> : <EmptyState title="No live preview yet" body="Run a study idea to fetch GBIF counts, facets, issue flags, and sample records." />}</CardContent>
    </Card>
  )
}

function DataPreviewPanel({ preview }: { preview: DataPreview }) {
  return (
    <div className="space-y-4">
      {preview.warnings.map((warning) => (
        <Alert key={warning} variant="warning">
          <AlertTriangle className="col-start-1 row-span-2 mt-0.5 size-4" />
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ))}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-2">
        <Metric label="Matching records" value={formatNumber(preview.counts.total)} />
        <Metric label="With coordinates" value={formatNumber(preview.counts.withCoordinates)} />
        <Metric label="Usable coordinates" value={formatNumber(preview.counts.withUsableCoordinates)} />
        <Metric label="Coordinates + date" value={formatNumber(preview.counts.withCoordinatesAndDate)} />
      </div>

      <SpatialCoveragePreview preview={preview} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Histogram title="Records by year" buckets={preview.facets.years} />
        <BarList title="Country distribution" buckets={preview.facets.countries.slice(0, 8)} formatter={countryLabel} />
        <BarList title="Basis of record" buckets={preview.facets.basisOfRecord} />
        <BarList title="Top datasets" buckets={preview.facets.datasets.slice(0, 6).map((dataset) => ({ name: dataset.title ?? dataset.name, count: dataset.count }))} />
        <BarList title="Taxonomic breakdown" buckets={preview.facets.taxa.slice(0, 8)} />
        <BarList title="GBIF issues and flags" buckets={preview.facets.issues.slice(0, 8)} formatter={formatIssueName} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <InfoBox
          title="Coordinate uncertainty"
          body={`${formatNumber(preview.coordinateUncertainty.recordsWithUncertainty)} of ${formatNumber(preview.coordinateUncertainty.sampledRecords)} sampled records report uncertainty.`}
          detail={`Median: ${preview.coordinateUncertainty.medianMeters === null ? 'not reported' : `${formatNumber(preview.coordinateUncertainty.medianMeters)} m`}; over 10 km: ${new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(preview.coordinateUncertainty.over10kmShare)}.`}
        />
        <InfoBox
          title="Sampling-event discovery"
          body={`${formatNumber(preview.samplingEvents.datasetHits)} dataset hits checked across ${preview.samplingEvents.countriesChecked.length ? preview.samplingEvents.countriesChecked.join(', ') : 'global GBIF'}.`}
          detail={preview.samplingEvents.note}
        />
      </div>
    </div>
  )
}

function TriageSection({
  triage,
  preview,
  workflow,
  query,
  activeWorkflowTab,
  onWorkflowTabChange,
}: {
  triage: TriageResult | null
  preview: DataPreview | null
  workflow: WorkflowPackage | null
  query: GbifQuery | null
  activeWorkflowTab: WorkflowTab
  onWorkflowTabChange: (tab: WorkflowTab) => void
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <SectionTitle icon={<ShieldAlert />} title="Triage and workflow" description="Claim support, risks, filters, and exportable code." />
      </CardHeader>
      <CardContent>
        {triage && preview && workflow && query ? (
          <div className="space-y-5">
            <SupportPanel triage={triage} />
            <RiskPanel risks={triage.risks} />
            <WorkflowPanel workflow={workflow} query={query} triage={triage} activeTab={activeWorkflowTab} setActiveTab={onWorkflowTabChange} />
          </div>
        ) : (
          <EmptyState title="Awaiting triage" body="GBIF Workbench will classify supported, conditional, exploratory, and unsupported claims after live analysis." />
        )}
      </CardContent>
    </Card>
  )
}

function SupportPanel({ triage }: { triage: TriageResult }) {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Can GBIF support this study?</span>
          <Badge variant="outline">Scope dependent</Badge>
        </div>
        <h2 className="text-xl font-semibold leading-tight">{triage.support.headline}</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Readiness label="Spatial" value={triage.readiness.spatial} />
        <Readiness label="Temporal" value={triage.readiness.temporal} />
        <Readiness label="Taxonomic" value={triage.readiness.taxonomic} />
        <Readiness label="Data type" value={triage.readiness.dataType} />
      </div>

      <div className="space-y-3">
        <SupportGroup title="Strongly supported" items={triage.support.stronglySupported} tone="good" />
        <SupportGroup title="Conditionally supported" items={triage.support.conditionallySupported} tone="caution" />
        <SupportGroup title="Exploratory only" items={triage.support.exploratoryOnly} tone="caution" />
        <SupportGroup title="Not supported by occurrence-only data" items={triage.support.notSupportedWithOccurrenceOnly} tone="danger" />
        <SupportGroup title="Insufficient data" items={triage.support.insufficientData} tone="danger" />
        <SupportGroup title="Unsupported claims" items={triage.unsupportedClaims} tone="danger" />
        <SupportGroup title="What to do next" items={triage.nextSteps} tone="good" />
      </div>
    </section>
  )
}

function RiskPanel({ risks }: { risks: Risk[] }) {
  const sorted = [...risks].sort((a, b) => riskWeight(b.level) - riskWeight(a.level))
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="size-4 text-amber-700" />
        Bias and limitation checks
      </div>
      <div className="space-y-3">
        {sorted.map((risk) => (
          <RiskCard key={`${risk.category}-${risk.title}`} risk={risk} />
        ))}
      </div>
    </section>
  )
}

function RiskCard({ risk }: { risk: Risk }) {
  return (
    <article className={`rounded-lg border p-4 ${riskToneClass(risk.level)}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-5">{risk.title}</h3>
        <Badge variant={riskBadgeVariant(risk.level)}>{risk.level}</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{risk.explanation}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <RiskDetail title="Evidence" body={risk.evidence} />
        <RiskDetail title="Why it matters" body={risk.whyItMatters} />
        <RiskDetail title="Mitigation" body={risk.recommendedMitigation} />
        {risk.relatedWorkflowStep && <RiskDetail title="Workflow step" body={risk.relatedWorkflowStep} />}
      </dl>
    </article>
  )
}

function WorkflowPanel({
  workflow,
  query,
  triage,
  activeTab,
  setActiveTab,
}: {
  workflow: WorkflowPackage
  query: GbifQuery
  triage: TriageResult
  activeTab: WorkflowTab
  setActiveTab: (tab: WorkflowTab) => void
}) {
  const tabContent = {
    r: workflow.rCode,
    python: workflow.pythonCode,
    sql: workflow.sqlCode,
    predicate: workflow.downloadRequestJson,
    cleaning: workflow.cleaningR,
    methods: workflow.methodsText,
    citation: workflow.citationInstructions,
    limitations: workflow.limitationsText,
  }[activeTab]

  return (
    <section id="exports" className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Code2 className="size-4 text-primary" />
        Generated workflow
      </div>
      <FilterSummary query={query} recommendedFilters={triage.recommendedFilters} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={query.gbifSearchUrl} target="_blank" rel="noreferrer">
            GBIF.org search <ExternalLink />
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={query.apiSearchUrl} target="_blank" rel="noreferrer">
            API preview <ExternalLink />
          </a>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkflowTab)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="r">R</TabsTrigger>
          <TabsTrigger value="python">Python</TabsTrigger>
          <TabsTrigger value="sql">SQL</TabsTrigger>
          <TabsTrigger value="predicate">Predicate</TabsTrigger>
          <TabsTrigger value="cleaning">Cleaning</TabsTrigger>
          <TabsTrigger value="methods">Methods</TabsTrigger>
          <TabsTrigger value="citation">Citation</TabsTrigger>
          <TabsTrigger value="limitations">Limits</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab}>
          <ScrollArea className="h-[360px] rounded-lg border bg-neutral-950">
            <pre className="p-4 font-mono text-xs leading-6 text-neutral-50">
              <code>{tabContent}</code>
            </pre>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ExportButton icon={<FileText />} label="Markdown" filename="gbif-workbench-plan.md" content={workflow.markdownReport} />
        <ExportButton icon={<FileJson />} label="JSON" filename="gbif-workbench-plan.json" content={workflow.jsonPlan} type="application/json" />
        <ExportButton icon={<Braces />} label="HTML" filename="gbif-workbench-report.html" content={workflow.htmlReport} type="text/html" />
        <ExportButton icon={<FileText />} label="Quarto" filename="gbif-workbench-workflow.qmd" content={createQuartoNotebook(workflow)} />
        <ExportButton icon={<Database />} label="SQL" filename="gbif-occurrence-cube.sql" content={workflow.sqlCode} />
        <ExportButton icon={<FileJson />} label="Predicate" filename="gbif-download-request.json" content={workflow.downloadRequestJson} type="application/json" />
        <ExportButton icon={<FileJson />} label="Jupyter" filename="gbif-workbench-workflow.ipynb" content={createJupyterNotebook(workflow)} type="application/json" />
        <ZipButton workflow={workflow} />
      </div>
    </section>
  )
}

function FilterSummary({ query, recommendedFilters }: { query: GbifQuery; recommendedFilters: string[] }) {
  const apiFilters = Object.entries(query.apiParams)
  return (
    <Card className="bg-muted/35">
      <CardContent className="space-y-3 p-4">
        <div>
          <strong className="text-sm">GBIF filters</strong>
          <div className="mt-2 flex flex-wrap gap-2">
            {apiFilters.map(([key, value]) => (
              <Badge key={key} variant="secondary">
                {formatFilterName(key)}: {formatFilterValue(value)}
              </Badge>
            ))}
          </div>
        </div>
        {recommendedFilters.length > 0 && (
          <div>
            <strong className="text-sm">Recommended filters</strong>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-muted-foreground">
              {recommendedFilters.map((filter) => (
                <li key={filter}>{filter}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MethodSection() {
  return (
    <Card id="method" className="2xl:col-span-2">
      <CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(240px,420px)]">
        <div>
          <h2 className="text-lg font-semibold">Scientific guardrail</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            GBIF Workbench does not certify data as valid. It summarizes GBIF-mediated data availability and common data-use risks for a proposed research question. Final suitability depends on method choice, taxon expertise, scale, and additional data sources.
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <Badge variant="outline" className="justify-start py-1.5">
            OpenAI structured outputs
          </Badge>
          <Badge variant="outline" className="justify-start py-1.5">
            Official GBIF identifiers
          </Badge>
          <Badge variant="outline" className="justify-start py-1.5">
            DOI-backed download guidance
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusCard({ status, preview, topRisk }: { status: Status; preview: DataPreview | null; topRisk?: Risk }) {
  return (
    <Card className="self-end" role="status" aria-live="polite">
      <CardContent className="flex items-start gap-3 p-4">
        <span className={`mt-1 size-2.5 shrink-0 rounded-full ${statusDotClass(status)}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{statusText(status, preview, topRisk)}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {status === 'ready' && preview ? `${formatNumber(preview.counts.total)} matching records in the current preview.` : 'Live GBIF previews are generated only after analysis runs.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function SectionTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
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

function TextField({
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
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function SelectField({
  id,
  label,
  value,
  onValueChange,
  options,
}: {
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id}>
          <SelectValue />
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-2xl font-semibold tracking-normal">{value}</strong>
    </div>
  )
}

function Readiness({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-sm text-muted-foreground">{value}</span>
      </div>
      <Progress value={value} />
    </div>
  )
}

function SupportGroup({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'caution' | 'danger' }) {
  if (!items.length) return null
  return (
    <div className={`rounded-lg border p-3 ${supportToneClass(tone)}`}>
      <strong className="text-sm">{title}</strong>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function RiskDetail({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <dt className="font-medium text-foreground">{title}</dt>
      <dd className="mt-0.5 leading-6 text-muted-foreground">{body}</dd>
    </div>
  )
}

function SpatialCoveragePreview({ preview }: { preview: DataPreview }) {
  const summary = useMemo(() => summarizeSpatialPreview(preview), [preview])

  if (!summary) {
    return <EmptyState title="No sample points returned" body="GBIF counts completed, but the sample-record request did not return plottable coordinates." />
  }

  return (
    <section className="rounded-lg border bg-card p-4" aria-label="Spatial coverage preview">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Map className="size-4 text-primary" />
            Spatial coverage check
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {summary.interpretation} The plot uses the live preview sample, not the full download.
          </p>
        </div>
        <Badge variant={summary.isConcentrated ? 'warning' : 'success'}>{summary.isConcentrated ? 'Concentrated sample' : 'Broad sample'}</Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-lg border bg-muted/35 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{formatCoordinate(summary.extent.maxLat, 'lat')}</span>
            <span>Zoomed to sample extent</span>
          </div>
          <svg className="block aspect-[16/9] w-full" viewBox="0 0 100 56" role="img" aria-label={`${summary.points.length} sampled occurrence points plotted in their local extent`}>
            <rect x="0" y="0" width="100" height="56" rx="3" className="fill-background" />
            {[20, 40, 60, 80].map((x) => (
              <line key={`zoom-x-${x}`} x1={x} x2={x} y1="0" y2="56" className="stroke-border" strokeWidth="0.22" />
            ))}
            {[14, 28, 42].map((y) => (
              <line key={`zoom-y-${y}`} y1={y} y2={y} x1="0" x2="100" className="stroke-border" strokeWidth="0.22" />
            ))}
            {summary.zoomedPoints.map((point, index) => (
              <circle
                key={`${point.x}-${point.y}-${index}`}
                cx={point.x}
                cy={point.y}
                r={point.hasHighUncertainty ? 1.8 : 1.35}
                className={point.hasHighUncertainty ? 'fill-amber-600 opacity-75' : 'fill-primary opacity-75'}
              />
            ))}
          </svg>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{formatCoordinate(summary.extent.minLon, 'lon')}</span>
            <span>{formatCoordinate(summary.extent.maxLon, 'lon')}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{formatCoordinate(summary.extent.minLat, 'lat')}</div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/35 p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Global locator</div>
            <svg className="block aspect-[100/52] w-full" viewBox="0 0 100 52" role="img" aria-label="Sample extent shown on a global coordinate grid">
              <rect x="0" y="0" width="100" height="52" rx="3" className="fill-background" />
              {[20, 40, 60, 80].map((x) => (
                <line key={`global-x-${x}`} x1={x} x2={x} y1="0" y2="52" className="stroke-border" strokeWidth="0.22" />
              ))}
              {[13, 26, 39].map((y) => (
                <line key={`global-y-${y}`} y1={y} y2={y} x1="0" x2="100" className="stroke-border" strokeWidth="0.22" />
              ))}
              <rect
                x={summary.globalBox.x}
                y={summary.globalBox.y}
                width={summary.globalBox.width}
                height={summary.globalBox.height}
                rx="1"
                className="fill-primary/20 stroke-primary"
                strokeWidth="0.6"
              />
            </svg>
          </div>
          <div className="grid gap-2 text-sm">
            <SpatialStat label="Sampled points" value={formatNumber(summary.points.length)} />
            <SpatialStat label="Countries in sample" value={summary.countryLabels.length ? String(summary.countryLabels.length) : 'Not reported'} />
            <SpatialStat label="Latitude range" value={`${formatCoordinate(summary.extent.minLat, 'lat')} to ${formatCoordinate(summary.extent.maxLat, 'lat')}`} />
            <SpatialStat label="Longitude range" value={`${formatCoordinate(summary.extent.minLon, 'lon')} to ${formatCoordinate(summary.extent.maxLon, 'lon')}`} />
          </div>
        </div>
      </div>

      {summary.countryLabels.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {summary.countryLabels.slice(0, 8).map((country) => (
            <Badge key={country} variant="secondary">
              {country}
            </Badge>
          ))}
        </div>
      )}
    </section>
  )
}

function SpatialStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-background px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right font-mono text-xs leading-5">{value}</strong>
    </div>
  )
}

function summarizeSpatialPreview(preview: DataPreview) {
  const points = preview.samplePoints.filter(hasValidPoint).slice(0, 220)
  if (!points.length) return null

  const lats = points.map((point) => point.lat)
  const lons = points.map((point) => point.lon)
  const extent = {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  }
  const latSpan = Math.max(0.01, extent.maxLat - extent.minLat)
  const lonSpan = Math.max(0.01, extent.maxLon - extent.minLon)
  const countryLabels = [...new Set(points.map((point) => point.country).filter((country): country is string => Boolean(country)))]
    .sort()
    .map((country) => countryLabel(country))
  const topCountry = preview.facets.countries[0]
  const topCountryText =
    topCountry && preview.counts.total
      ? `${countryLabel(topCountry.name)} accounts for ${new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(topCountry.count / preview.counts.total)} of matching records`
      : 'No country facet dominated the preview response'
  const isConcentrated = (latSpan < 5 && lonSpan < 5) || (countryLabels.length <= 1 && points.length >= 10)

  return {
    points,
    extent,
    countryLabels,
    isConcentrated,
    interpretation: isConcentrated
      ? `Preview points are clustered across about ${formatDegrees(latSpan)} latitude by ${formatDegrees(lonSpan)} longitude. ${topCountryText}.`
      : `Preview points cover about ${formatDegrees(latSpan)} latitude by ${formatDegrees(lonSpan)} longitude. ${topCountryText}.`,
    zoomedPoints: points.map((point) => ({
      x: 6 + ((point.lon - extent.minLon) / lonSpan) * 88,
      y: 6 + ((extent.maxLat - point.lat) / latSpan) * 44,
      hasHighUncertainty: (point.coordinateUncertaintyInMeters ?? 0) > 10000,
    })),
    globalBox: createGlobalExtentBox(extent),
  }
}

function hasValidPoint(point: OccurrencePoint) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon) && point.lat >= -90 && point.lat <= 90 && point.lon >= -180 && point.lon <= 180
}

function createGlobalExtentBox(extent: { minLat: number; maxLat: number; minLon: number; maxLon: number }) {
  const minX = ((extent.minLon + 180) / 360) * 100
  const maxX = ((extent.maxLon + 180) / 360) * 100
  const minY = ((90 - extent.maxLat) / 180) * 52
  const maxY = ((90 - extent.minLat) / 180) * 52
  const rawWidth = Math.max(0.1, maxX - minX)
  const rawHeight = Math.max(0.1, maxY - minY)
  const width = Math.max(1.8, rawWidth)
  const height = Math.max(1.8, rawHeight)
  return {
    x: clamp(minX - (width - rawWidth) / 2, 0, 100 - width),
    y: clamp(minY - (height - rawHeight) / 2, 0, 52 - height),
    width,
    height,
  }
}

function formatCoordinate(value: number, axis: 'lat' | 'lon') {
  const direction = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'
  return `${Math.abs(value).toFixed(Math.abs(value) >= 10 ? 1 : 2)}° ${direction}`
}

function formatDegrees(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}°`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function Histogram({ title, buckets }: { title: string; buckets: CountBucket[] }) {
  const visible = buckets.slice(-28)
  const max = Math.max(1, ...visible.map((bucket) => bucket.count))
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 flex h-36 items-end gap-1 border-b pb-2">
        {visible.map((bucket) => (
          <span
            key={bucket.name}
            className="min-w-0 flex-1 rounded-t bg-primary"
            title={`${bucket.name}: ${formatNumber(bucket.count)}`}
            style={{ height: `${Math.max(5, (bucket.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <small className="mt-2 block text-xs text-muted-foreground">
        {visible[0]?.name ?? 'n/a'} {visible.length > 1 ? `to ${visible.at(-1)?.name}` : ''}
      </small>
    </section>
  )
}

function BarList({
  title,
  buckets,
  formatter = (value: string) => value,
}: {
  title: string
  buckets: CountBucket[]
  formatter?: (value: string) => string
}) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count))
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {buckets.length ? (
          buckets.map((bucket) => (
            <div key={bucket.name} className="grid grid-cols-[minmax(76px,1.2fr)_minmax(70px,1fr)_auto] items-center gap-2 text-xs">
              <span className="truncate text-muted-foreground">{formatter(bucket.name)}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <i className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (bucket.count / max) * 100)}%` }} />
              </div>
              <em className="font-mono not-italic text-muted-foreground">{formatNumber(bucket.count)}</em>
            </div>
          ))
        ) : (
          <small className="text-xs text-muted-foreground">No facet values returned.</small>
        )}
      </div>
    </section>
  )
}

function InfoBox({ title, body, detail }: { title: string; body: string; detail: string }) {
  return (
    <div className="rounded-lg border bg-accent/45 p-4 text-sm">
      <strong>{title}</strong>
      <p className="mt-2 leading-6">{body}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-lg border border-dashed p-8 text-center">
      <div className="max-w-sm">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

function ExportButton({
  icon,
  label,
  filename,
  content,
  type = 'text/markdown',
}: {
  icon: ReactNode
  label: string
  filename: string
  content: string
  type?: string
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => downloadBlob(filename, new Blob([content], { type: withCharset(type) }))}>
      {icon}
      {label}
    </Button>
  )
}

function ZipButton({ workflow }: { workflow: WorkflowPackage }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="min-w-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={loading}
        aria-busy={loading}
        onClick={async () => {
          setLoading(true)
          setError('')
          try {
            const blob = await createExportZip(workflow)
            downloadBlob('gbif-workbench-export.zip', blob)
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not create ZIP export.')
          } finally {
            setLoading(false)
          }
        }}
      >
        {loading ? <Loader2 className="animate-spin" /> : <FileArchive />}
        ZIP
      </Button>
      {error && (
        <p className="mt-1 text-xs leading-5 text-destructive" role="alert">
          ZIP export failed. {error}
        </p>
      )}
    </div>
  )
}

function parseYearRange(value: string) {
  const match = value.match(/(18\d{2}|19\d{2}|20\d{2})\s*(?:-|to|through)?\s*(18\d{2}|19\d{2}|20\d{2})?/)
  if (!match) return null
  const start = Number(match[1])
  const end = match[2] ? Number(match[2]) : new Date().getFullYear()
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

function numberOrNull(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(Math.round(value))
}

function formatIssueName(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatFilterName(value: string) {
  return value.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`).replace(/^./, (match) => match.toUpperCase())
}

function formatFilterValue(value: string | number | boolean | string[]) {
  return Array.isArray(value) ? value.join(', ') : String(value)
}

function statusText(status: Status, preview: DataPreview | null, topRisk?: Risk) {
  if (status === 'interpreting') return 'Interpreting study scope'
  if (status === 'previewing') return 'Running OpenAI and GBIF analysis'
  if (status === 'error') return 'Analysis failed'
  if (status === 'ready' && topRisk) return `${preview?.counts.withUsableCoordinates.toLocaleString()} usable records · ${topRisk.level.toLowerCase()} ${topRisk.title.toLowerCase()}`
  if (status === 'ready' && preview) return `${preview.counts.withUsableCoordinates.toLocaleString()} usable records · workflow ready`
  return 'Ready to analyze'
}

function statusDotClass(status: Status) {
  if (status === 'ready') return 'bg-primary'
  if (status === 'interpreting' || status === 'previewing') return 'bg-amber-500'
  if (status === 'error') return 'bg-destructive'
  return 'bg-muted-foreground'
}

function riskWeight(level: string) {
  return { BLOCKING: 5, HIGH: 4, MODERATE: 3, UNKNOWN: 2, LOW: 1 }[level as keyof Record<string, number>] ?? 0
}

function riskToneClass(level: Risk['level']) {
  if (level === 'BLOCKING' || level === 'HIGH') return 'border-red-200 bg-red-50/70'
  if (level === 'MODERATE' || level === 'UNKNOWN') return 'border-amber-200 bg-amber-50/70'
  return 'border-emerald-200 bg-emerald-50/70'
}

function riskBadgeVariant(level: Risk['level']) {
  if (level === 'BLOCKING' || level === 'HIGH') return 'destructive'
  if (level === 'MODERATE' || level === 'UNKNOWN') return 'warning'
  return 'success'
}

function supportToneClass(tone: 'good' | 'caution' | 'danger') {
  if (tone === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-950'
  if (tone === 'caution') return 'border-amber-200 bg-amber-50 text-amber-950'
  return 'border-red-200 bg-red-50 text-red-950'
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function withCharset(type: string) {
  return type.includes('charset=') || type === 'application/zip' ? type : `${type};charset=utf-8`
}

export default App
