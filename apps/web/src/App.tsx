import { startTransition, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { geoEqualEarth, geoGraticule, geoMercator, geoPath } from 'd3-geo'
import type { GeoPermissibleObjects, GeoProjection } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry, MultiPoint, Polygon } from 'geojson'
import type { GeometryCollection as TopoGeometryCollection, Topology } from 'topojson-specification'
import countries110m from 'world-atlas/countries-110m.json'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  Info,
  Loader2,
  Map,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
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
import { createExportZip } from './lib/exportPackage'
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

type WorkflowGroup = 'code' | 'query' | 'writeup' | 'cleaning'
type Status = 'idle' | 'interpreting' | 'previewing' | 'ready' | 'error'
type StepState = 'done' | 'current' | 'pending'

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
// Workflow code is grouped into 4 tabs to reduce the previous 8-tab clutter
// and make Code/Query/Write-up/Cleaning each feel like a distinct phase of
// the research workflow. Each group exposes a sub-selector when needed.
const WORKFLOW_GROUPS: Record<WorkflowGroup, { label: string; icon: ReactNode }> = {
  code: { label: 'Code', icon: <Code2 /> },
  query: { label: 'Query', icon: <Database /> },
  writeup: { label: 'Write-up', icon: <FileText /> },
  cleaning: { label: 'Cleaning', icon: <ClipboardList /> },
}

// Hoisted option lists with the "Infer automatically" sentinel prepended so
// SelectField consumers receive a stable array reference each render.
const SPATIAL_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: 'infer', label: 'Infer automatically' },
  ...SPATIAL_OPTIONS.map((value) => ({ value, label: value })),
]
const SKILL_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: 'infer', label: 'Infer automatically' },
  ...SKILL_OPTIONS.map((value) => ({ value, label: value })),
]

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

// Hoisted lookup tables. The functions below used to allocate fresh objects /
// run if-else ladders on every call; converting to Map-style lookups means
// each table is built once at module load and every subsequent call is O(1).
const RISK_WEIGHT_MAP: Record<Risk['level'], number> = {
  BLOCKING: 5,
  HIGH: 4,
  MODERATE: 3,
  UNKNOWN: 2,
  LOW: 1,
}
const RISK_TONE_MAP: Record<Risk['level'], string> = {
  BLOCKING: 'border-red-200 bg-red-50/70',
  HIGH: 'border-red-200 bg-red-50/70',
  MODERATE: 'border-amber-200 bg-amber-50/70',
  UNKNOWN: 'border-amber-200 bg-amber-50/70',
  LOW: 'border-emerald-200 bg-emerald-50/70',
}
const RISK_BADGE_VARIANT_MAP: Record<Risk['level'], 'destructive' | 'warning' | 'success'> = {
  BLOCKING: 'destructive',
  HIGH: 'destructive',
  MODERATE: 'warning',
  UNKNOWN: 'warning',
  LOW: 'success',
}
const SUPPORT_TONE_MAP: Record<'good' | 'caution' | 'danger', string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  caution: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-red-200 bg-red-50 text-red-950',
}
const STATUS_DOT_MAP: Record<Status, string> = {
  idle: 'bg-muted-foreground',
  interpreting: 'bg-amber-500',
  previewing: 'bg-amber-500',
  ready: 'bg-primary',
  error: 'bg-destructive',
}

// Hoisted export-button icons. Capturing each icon as a single React element at
// module scope lets ExportButton receive a stable prop reference across renders
// instead of a freshly-constructed element on every parent render.
const ZOOM_MAP_WIDTH = 960
const ZOOM_MAP_HEIGHT = 520
const GLOBAL_MAP_WIDTH = 260
const GLOBAL_MAP_HEIGHT = 136
const WORLD_TOPOLOGY = countries110m as unknown as Topology
const WORLD_OBJECTS = countries110m.objects as { countries: TopoGeometryCollection }
const WORLD_COUNTRIES = (feature(WORLD_TOPOLOGY, WORLD_OBJECTS.countries) as FeatureCollection<Geometry>).features
const WORLD_SPHERE = { type: 'Sphere' } as GeoPermissibleObjects

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
  const [activeWorkflowGroup, setActiveWorkflowGroup] = useState<WorkflowGroup>('code')
  const [activeCodeLanguage, setActiveCodeLanguage] = useState<'r' | 'python'>('r')
  const [activeWriteupTab, setActiveWriteupTab] = useState<'methods' | 'citation' | 'limitations'>('methods')
  const [activeQueryTab, setActiveQueryTab] = useState<'sql' | 'predicate'>('sql')

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
      // Mark the status dot as urgent so the header updates immediately, then
      // defer the bulk of the result tree (intent, preview, triage, workflow,
      // query, taxon) so React can keep the spinner and input responsive
      // while the heavy result subtree commits.
      setStatus('ready')
      startTransition(() => {
        setIntent(result.intent)
        setTaxon(result.taxon)
        setQuery(result.query)
        setPreview(result.preview)
        setTriage(result.triage)
        setWorkflow(result.workflow)
      })
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
          <WorkflowProgress status={status} question={question} intent={intent} preview={preview} workflow={workflow} />
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
            <ResultOverview preview={preview} triage={triage} workflow={workflow} />
            <DataPreviewSection preview={preview} />
            <TriageSection
              triage={triage}
              preview={preview}
              workflow={workflow}
              query={query}
              activeWorkflowGroup={activeWorkflowGroup}
              setActiveWorkflowGroup={setActiveWorkflowGroup}
              activeCodeLanguage={activeCodeLanguage}
              setActiveCodeLanguage={setActiveCodeLanguage}
              activeWriteupTab={activeWriteupTab}
              setActiveWriteupTab={setActiveWriteupTab}
              activeQueryTab={activeQueryTab}
              setActiveQueryTab={setActiveQueryTab}
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
  const total = preview.counts.total
  return (
    <div className="space-y-4">
      {preview.warnings.map((warning) => (
        <Alert key={warning} variant="warning">
          <AlertTriangle className="col-start-1 row-span-2 mt-0.5 size-4" />
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ))}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-2">
        <Metric label="Matching records" value={formatNumber(total)} detail="Current scope" />
        <Metric label="With coordinates" value={formatNumber(preview.counts.withCoordinates)} detail={formatShare(preview.counts.withCoordinates, total)} />
        <Metric label="Usable coordinates" value={formatNumber(preview.counts.withUsableCoordinates)} detail={formatShare(preview.counts.withUsableCoordinates, total)} />
        <Metric label="Coordinates + date" value={formatNumber(preview.counts.withCoordinatesAndDate)} detail={formatShare(preview.counts.withCoordinatesAndDate, total)} />
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
  activeWorkflowGroup,
  setActiveWorkflowGroup,
  activeCodeLanguage,
  setActiveCodeLanguage,
  activeWriteupTab,
  setActiveWriteupTab,
  activeQueryTab,
  setActiveQueryTab,
}: {
  triage: TriageResult | null
  preview: DataPreview | null
  workflow: WorkflowPackage | null
  query: GbifQuery | null
  activeWorkflowGroup: WorkflowGroup
  setActiveWorkflowGroup: (group: WorkflowGroup) => void
  activeCodeLanguage: 'r' | 'python'
  setActiveCodeLanguage: (language: 'r' | 'python') => void
  activeWriteupTab: 'methods' | 'citation' | 'limitations'
  setActiveWriteupTab: (tab: 'methods' | 'citation' | 'limitations') => void
  activeQueryTab: 'sql' | 'predicate'
  setActiveQueryTab: (tab: 'sql' | 'predicate') => void
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
            <WorkflowPanel
              workflow={workflow}
              query={query}
              triage={triage}
              activeGroup={activeWorkflowGroup}
              setActiveGroup={setActiveWorkflowGroup}
              activeCodeLanguage={activeCodeLanguage}
              setActiveCodeLanguage={setActiveCodeLanguage}
              activeWriteupTab={activeWriteupTab}
              setActiveWriteupTab={setActiveWriteupTab}
              activeQueryTab={activeQueryTab}
              setActiveQueryTab={setActiveQueryTab}
            />
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
        {sorted.map((risk, index) => (
          <RiskCard key={`${risk.category}-${risk.title}`} risk={risk} defaultOpen={index < 2} />
        ))}
      </div>
    </section>
  )
}

function RiskCard({ risk, defaultOpen }: { risk: Risk; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className={`group rounded-lg border p-4 ${riskToneClass(risk.level)} [&_summary::-webkit-details-marker]:hidden`}>
      <summary className="cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold leading-5">{risk.title}</h3>
          <Badge variant={riskBadgeVariant(risk.level)}>{risk.level}</Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{risk.explanation}</p>
        <span className="mt-2 inline-block text-xs font-medium text-muted-foreground group-open:hidden">Show evidence and mitigation</span>
        <span className="mt-2 hidden text-xs font-medium text-muted-foreground group-open:inline-block">Hide evidence and mitigation</span>
      </summary>
      <dl className="mt-3 space-y-2 border-t pt-3 text-sm">
        <RiskDetail title="Evidence" body={risk.evidence} />
        <RiskDetail title="Why it matters" body={risk.whyItMatters} />
        <RiskDetail title="Mitigation" body={risk.recommendedMitigation} />
        {risk.relatedWorkflowStep && <RiskDetail title="Workflow step" body={risk.relatedWorkflowStep} />}
      </dl>
    </details>
  )
}

function WorkflowPanel({
  workflow,
  query,
  triage,
  activeGroup,
  setActiveGroup,
  activeCodeLanguage,
  setActiveCodeLanguage,
  activeWriteupTab,
  setActiveWriteupTab,
  activeQueryTab,
  setActiveQueryTab,
}: {
  workflow: WorkflowPackage
  query: GbifQuery
  triage: TriageResult
  activeGroup: WorkflowGroup
  setActiveGroup: (group: WorkflowGroup) => void
  activeCodeLanguage: 'r' | 'python'
  setActiveCodeLanguage: (language: 'r' | 'python') => void
  activeWriteupTab: 'methods' | 'citation' | 'limitations'
  setActiveWriteupTab: (tab: 'methods' | 'citation' | 'limitations') => void
  activeQueryTab: 'sql' | 'predicate'
  setActiveQueryTab: (tab: 'sql' | 'predicate') => void
}) {
  // Each group resolves to a piece of workflow text plus the right Copy label.
  // `useMemo` keeps the prose block from recomputing its lines on unrelated
  // parent re-renders (the write-up texts are the heaviest artifacts).
  const codeContent = useMemo(
    () => (activeCodeLanguage === 'r' ? workflow.rCode : workflow.pythonCode),
    [activeCodeLanguage, workflow.rCode, workflow.pythonCode],
  )
  const codeLabel = activeCodeLanguage === 'r' ? 'R' : 'Python'

  const queryContent = activeQueryTab === 'sql' ? workflow.sqlCode : workflow.downloadRequestJson
  const queryLabel = activeQueryTab === 'sql' ? 'SQL' : 'Predicate'

  const writeupContent = useMemo(() => {
    if (activeWriteupTab === 'methods') return workflow.methodsText
    if (activeWriteupTab === 'citation') return workflow.citationInstructions
    return workflow.limitationsText
  }, [activeWriteupTab, workflow.methodsText, workflow.citationInstructions, workflow.limitationsText])
  const writeupLabel =
    activeWriteupTab === 'methods'
      ? 'Methods'
      : activeWriteupTab === 'citation'
        ? 'Citation'
        : 'Limitations'

  const copyContent =
    activeGroup === 'code'
      ? codeContent
      : activeGroup === 'query'
        ? queryContent
        : activeGroup === 'writeup'
          ? writeupContent
          : workflow.cleaningR
  const copyLabel =
    activeGroup === 'code'
      ? `Copy ${codeLabel}`
      : activeGroup === 'query'
        ? `Copy ${queryLabel}`
        : activeGroup === 'writeup'
          ? `Copy ${writeupLabel}`
          : 'Copy R cleaning'

  return (
    <section id="exports" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Code2 className="size-4 text-primary" />
          Generated workflow
        </div>
        <CopyButton content={copyContent} label={copyLabel} />
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

      <Tabs value={activeGroup} onValueChange={(value) => setActiveGroup(value as WorkflowGroup)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          {Object.entries(WORKFLOW_GROUPS).map(([value, group]) => (
            <TabsTrigger key={value} value={value}>
              {group.icon}
              {group.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="code" className="min-h-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1" role="tablist" aria-label="Code language">
              {(['r', 'python'] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  role="tab"
                  aria-selected={activeCodeLanguage === language}
                  onClick={() => setActiveCodeLanguage(language)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    activeCodeLanguage === language
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {language === 'r' ? 'R' : 'Python'}
                </button>
              ))}
            </div>
            <ExportButton
              icon={<Download />}
              label={codeLabel}
              filename={activeCodeLanguage === 'r' ? 'gbif-workbench-workflow.R' : 'gbif-workbench-workflow.py'}
              content={codeContent}
            />
          </div>
          <CodeBlock content={codeContent} language={codeLabel} />
        </TabsContent>

        <TabsContent value="query" className="min-h-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1" role="tablist" aria-label="Query type">
              {(['sql', 'predicate'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeQueryTab === tab}
                  onClick={() => setActiveQueryTab(tab)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    activeQueryTab === tab
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab === 'sql' ? 'SQL' : 'Predicate'}
                </button>
              ))}
            </div>
            <ExportButton
              icon={<Download />}
              label={queryLabel}
              filename={activeQueryTab === 'sql' ? 'gbif-occurrence-cube.sql' : 'gbif-download-request.json'}
              content={queryContent}
              type={activeQueryTab === 'sql' ? undefined : 'application/json'}
            />
          </div>
          <CodeBlock content={queryContent} language={queryLabel === 'SQL' ? 'sql' : 'json'} />
        </TabsContent>

        <TabsContent value="writeup" className="min-h-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1" role="tablist" aria-label="Write-up section">
              {(['methods', 'citation', 'limitations'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeWriteupTab === tab}
                  onClick={() => setActiveWriteupTab(tab)}
                  className={`rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors ${
                    activeWriteupTab === tab
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <ExportButton
              icon={<Download />}
              label={writeupLabel}
              filename={
                activeWriteupTab === 'methods'
                  ? 'gbif-workbench-methods.md'
                  : activeWriteupTab === 'citation'
                    ? 'gbif-workbench-citation.md'
                    : 'gbif-workbench-limitations.md'
              }
              content={writeupContent}
            />
          </div>
          <ProseBlock content={writeupContent} />
        </TabsContent>

        <TabsContent value="cleaning" className="min-h-0">
          <div className="mb-2 flex items-center justify-end gap-2">
            <ExportButton
              icon={<Download />}
              label="Cleaning"
              filename="gbif-workbench-cleaning.R"
              content={workflow.cleaningR}
            />
          </div>
          <CodeBlock content={workflow.cleaningR} language="R" />
        </TabsContent>
      </Tabs>

      <ZipButton workflow={workflow} query={query} />
    </section>
  )
}

// Code/prose block fills the parent column rather than fixed 360px so it
// grows with the right-hand triage column on tall viewports. The ScrollArea
// inside the code block handles overflow on smaller viewports.
function CodeBlock({ content, language }: { content: string; language: string }) {
  return (
    <ScrollArea className="min-h-[420px] flex-1 rounded-lg border bg-neutral-950">
      <pre className="p-4 font-mono text-xs leading-6 text-neutral-50">
        <code data-language={language.toLowerCase()}>{content}</code>
      </pre>
    </ScrollArea>
  )
}

function ProseBlock({ content }: { content: string }) {
  return (
    <ScrollArea className="min-h-[420px] flex-1 rounded-lg border bg-card">
      <div className="p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">{content}</pre>
      </div>
    </ScrollArea>
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

function WorkflowProgress({
  status,
  question,
  intent,
  preview,
  workflow,
}: {
  status: Status
  question: string
  intent: StudyIntent | null
  preview: DataPreview | null
  workflow: WorkflowPackage | null
}) {
  const steps: { label: string; state: StepState }[] = [
    { label: 'Question', state: question.trim() ? 'done' : 'current' },
    { label: 'Scope', state: intent ? 'done' : question.trim() || status === 'interpreting' ? 'current' : 'pending' },
    { label: 'Preview', state: preview ? 'done' : intent || status === 'previewing' ? 'current' : 'pending' },
    { label: 'Export', state: workflow ? 'done' : preview ? 'current' : 'pending' },
  ]

  return (
    <div className="grid gap-2 rounded-lg border bg-card p-2 sm:grid-cols-4 lg:col-span-2" aria-label="Workflow progress">
      {steps.map((step, index) => (
        <div key={step.label} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${stepStateClass(step.state)}`}>
          <span className="grid size-6 shrink-0 place-items-center rounded-full border bg-background text-xs font-medium">
            {step.state === 'done' ? <Check className="size-3.5" /> : index + 1}
          </span>
          <span className="min-w-0 truncate font-medium">{step.label}</span>
          <span className="ml-auto text-xs text-muted-foreground">{stepStateLabel(step.state)}</span>
        </div>
      ))}
    </div>
  )
}

function ResultOverview({ preview, triage, workflow }: { preview: DataPreview | null; triage: TriageResult | null; workflow: WorkflowPackage | null }) {
  if (!preview || !triage) return null
  const topRisk = triage.risks.toSorted((a, b) => riskWeight(b.level) - riskWeight(a.level))[0]
  const readinessAverage = Math.round((triage.readiness.spatial + triage.readiness.temporal + triage.readiness.taxonomic + triage.readiness.dataType) / 4)

  return (
    <Card className="min-w-0 2xl:col-span-2">
      <CardContent className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Decision summary</h2>
            {topRisk && <Badge variant={riskBadgeVariant(topRisk.level)}>{topRisk.level}</Badge>}
            {workflow && <Badge variant="success">Exports ready</Badge>}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{triage.support.headline}</p>
          {topRisk && <p className="mt-1 text-sm leading-6 text-muted-foreground">Top risk: {topRisk.title}</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
          <SummaryStat label="Usable records" value={formatNumber(preview.counts.withUsableCoordinates)} />
          <SummaryStat label="Readiness" value={`${readinessAverage}/100`} />
          <SummaryStat label="Next step" value={triage.nextSteps[0] ?? 'Review generated workflow'} />
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

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-2xl font-semibold tracking-normal">{value}</strong>
      {detail && <span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span>}
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <strong className="mt-1 block line-clamp-2 text-sm leading-5">{value}</strong>
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
  const zoomMap = useMemo(() => (summary ? createZoomMapData(summary) : null), [summary])
  const globalMap = useMemo(() => (summary ? createGlobalMapData(summary) : null), [summary])

  if (!summary || !zoomMap || !globalMap) {
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
            {summary.interpretation} The map uses country outlines and the live preview sample, not the full download.
          </p>
        </div>
        <Badge variant={summary.isConcentrated ? 'warning' : 'success'}>{summary.isConcentrated ? 'Concentrated sample' : 'Broad sample'}</Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-lg border bg-muted/35 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{formatCoordinate(summary.extent.maxLat, 'lat')}</span>
            <span>Map view, zoomed to sample extent</span>
          </div>
          <svg className="block aspect-[16/9] w-full rounded-md bg-background" viewBox={`0 0 ${ZOOM_MAP_WIDTH} ${ZOOM_MAP_HEIGHT}`} role="img" aria-label={`${summary.points.length} sampled occurrence points plotted on a geographic map`}>
            <rect x="0" y="0" width={ZOOM_MAP_WIDTH} height={ZOOM_MAP_HEIGHT} rx="12" className="fill-background" />
            {zoomMap.countryPaths.map((path) => (
              <path key={path.key} d={path.d} className="fill-muted stroke-border" strokeWidth="1.2" />
            ))}
            {zoomMap.graticulePath && <path d={zoomMap.graticulePath} fill="none" className="stroke-border opacity-70" strokeWidth="0.8" />}
            {zoomMap.points.map((point, index) => (
              <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={point.hasHighUncertainty ? 8 : 6} className={point.hasHighUncertainty ? 'fill-amber-600 opacity-85' : 'fill-primary opacity-85'} />
            ))}
          </svg>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><i className="block size-2 rounded-full bg-primary" />Preview record</span>
              <span className="inline-flex items-center gap-1"><i className="block size-2 rounded-full bg-amber-600" />High uncertainty</span>
            </div>
            <span>{formatCoordinate(summary.extent.minLon, 'lon')} to {formatCoordinate(summary.extent.maxLon, 'lon')}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{formatCoordinate(summary.extent.minLat, 'lat')}</div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/35 p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Global locator</div>
            <svg className="block aspect-[100/52] w-full rounded-md bg-background" viewBox={`0 0 ${GLOBAL_MAP_WIDTH} ${GLOBAL_MAP_HEIGHT}`} role="img" aria-label="Sample extent shown on a global map">
              <rect x="0" y="0" width={GLOBAL_MAP_WIDTH} height={GLOBAL_MAP_HEIGHT} rx="8" className="fill-background" />
              {globalMap.graticulePath && <path d={globalMap.graticulePath} fill="none" className="stroke-border opacity-60" strokeWidth="0.45" />}
              {globalMap.countryPaths.map((path) => (
                <path key={path.key} d={path.d} className="fill-muted stroke-border" strokeWidth="0.45" />
              ))}
              {globalMap.extentPath && <path d={globalMap.extentPath} className="fill-primary/20 stroke-primary" strokeWidth="1.2" />}
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

  // Single pass to compute lat/lon extent and collect distinct country codes.
  // The Math.min/max spread form would allocate two extra arrays of length N
  // and could blow the argument limit for very large samples; a single loop
  // is both faster and safer.
  let minLat = points[0].lat
  let maxLat = points[0].lat
  let minLon = points[0].lon
  let maxLon = points[0].lon
  const countrySet = new Set<string>()
  for (const point of points) {
    if (point.lat < minLat) minLat = point.lat
    else if (point.lat > maxLat) maxLat = point.lat
    if (point.lon < minLon) minLon = point.lon
    else if (point.lon > maxLon) maxLon = point.lon
    if (point.country) countrySet.add(point.country)
  }
  const extent = { minLat, maxLat, minLon, maxLon }
  const latSpan = Math.max(0.01, extent.maxLat - extent.minLat)
  const lonSpan = Math.max(0.01, extent.maxLon - extent.minLon)
  const countryLabels = Array.from(countrySet).sort().map((country) => countryLabel(country))
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
  }
}

function hasValidPoint(point: OccurrencePoint) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon) && point.lat >= -90 && point.lat <= 90 && point.lon >= -180 && point.lon <= 180
}

type SpatialSummary = Exclude<ReturnType<typeof summarizeSpatialPreview>, null>

function createZoomMapData(summary: SpatialSummary) {
  const paddedExtent = padExtent(summary.extent, 0.5)
  const projection = geoMercator().fitExtent(
    [
      [24, 24],
      [ZOOM_MAP_WIDTH - 24, ZOOM_MAP_HEIGHT - 24],
    ],
    createExtentPointFeature(paddedExtent),
  )
  const path = geoPath(projection)
  const graticule = geoGraticule().step([chooseGraticuleStep(paddedExtent.maxLon - paddedExtent.minLon), chooseGraticuleStep(paddedExtent.maxLat - paddedExtent.minLat)])()

  return {
    countryPaths: createCountryPaths(path),
    graticulePath: path(graticule),
    points: projectOccurrencePoints(summary.points, projection),
  }
}

function createGlobalMapData(summary: SpatialSummary) {
  const projection = geoEqualEarth().fitExtent(
    [
      [6, 6],
      [GLOBAL_MAP_WIDTH - 6, GLOBAL_MAP_HEIGHT - 6],
    ],
    WORLD_SPHERE,
  )
  const path = geoPath(projection)
  const graticule = geoGraticule().step([60, 30])()
  return {
    countryPaths: createCountryPaths(path),
    graticulePath: path(graticule),
    extentPath: path(createExtentFeature(padExtent(summary.extent, 0.25))),
  }
}

function createCountryPaths(path: ReturnType<typeof geoPath>) {
  return WORLD_COUNTRIES.map((country, index) => {
    const d = path(country)
    return d ? { key: `${country.id ?? index}`, d } : null
  }).filter((item): item is { key: string; d: string } => Boolean(item))
}

function projectOccurrencePoints(points: OccurrencePoint[], projection: GeoProjection) {
  return points
    .map((point) => {
      const projected = projection([point.lon, point.lat])
      if (!projected) return null
      return {
        x: projected[0],
        y: projected[1],
        hasHighUncertainty: (point.coordinateUncertaintyInMeters ?? 0) > 10000,
      }
    })
    .filter((point): point is { x: number; y: number; hasHighUncertainty: boolean } => Boolean(point))
}

function createExtentFeature(extent: { minLat: number; maxLat: number; minLon: number; maxLon: number }): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [extent.minLon, extent.minLat],
          [extent.maxLon, extent.minLat],
          [extent.maxLon, extent.maxLat],
          [extent.minLon, extent.maxLat],
          [extent.minLon, extent.minLat],
        ],
      ],
    },
  }
}

function createExtentPointFeature(extent: { minLat: number; maxLat: number; minLon: number; maxLon: number }): Feature<MultiPoint> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiPoint',
      coordinates: [
        [extent.minLon, extent.minLat],
        [extent.maxLon, extent.maxLat],
      ],
    },
  }
}

function padExtent(extent: { minLat: number; maxLat: number; minLon: number; maxLon: number }, multiplier: number) {
  const latSpan = Math.max(0.05, extent.maxLat - extent.minLat)
  const lonSpan = Math.max(0.05, extent.maxLon - extent.minLon)
  const latPadding = Math.max(0.35, latSpan * multiplier)
  const lonPadding = Math.max(0.35, lonSpan * multiplier)
  return {
    minLat: clamp(extent.minLat - latPadding, -85, 85),
    maxLat: clamp(extent.maxLat + latPadding, -85, 85),
    minLon: clamp(extent.minLon - lonPadding, -180, 180),
    maxLon: clamp(extent.maxLon + lonPadding, -180, 180),
  }
}

function chooseGraticuleStep(span: number) {
  if (span <= 3) return 0.5
  if (span <= 8) return 1
  if (span <= 20) return 5
  if (span <= 60) return 10
  return 30
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
              <span className="truncate text-muted-foreground" title={formatter(bucket.name)}>
                {formatter(bucket.name)}
              </span>
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

function CopyButton({ content, label }: { content: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await writeClipboard(content)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1400)
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

function ZipButton({ workflow, query }: { workflow: WorkflowPackage; query: GbifQuery }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="flex min-w-0 justify-end">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-auto"
        disabled={loading}
        aria-busy={loading}
        onClick={async () => {
          setLoading(true)
          setError('')
          try {
            const blob = await createExportZip(workflow, query)
            downloadBlob('gbif-workbench-export.zip', blob)
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not create ZIP export.')
          } finally {
            setLoading(false)
          }
        }}
      >
        {loading ? <Loader2 className="animate-spin" /> : <FileArchive />}
        Download ZIP
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

function formatShare(value: number, total: number) {
  if (!total) return 'No matching records'
  return `${new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(value / total)} of matches`
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
  return STATUS_DOT_MAP[status] ?? 'bg-muted-foreground'
}

function stepStateClass(state: StepState) {
  if (state === 'done') return 'bg-emerald-50 text-emerald-950'
  if (state === 'current') return 'bg-accent text-accent-foreground'
  return 'bg-background text-muted-foreground'
}

function stepStateLabel(state: StepState) {
  if (state === 'done') return 'Done'
  if (state === 'current') return 'Current'
  return 'Pending'
}

function riskWeight(level: string) {
  return RISK_WEIGHT_MAP[level as Risk['level']] ?? 0
}

function riskToneClass(level: Risk['level']) {
  return RISK_TONE_MAP[level]
}

function riskBadgeVariant(level: Risk['level']) {
  return RISK_BADGE_VARIANT_MAP[level]
}

function supportToneClass(tone: 'good' | 'caution' | 'danger') {
  return SUPPORT_TONE_MAP[tone]
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

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

export default App
