import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  ClipboardList,
  Code2,
  Database,
  Download,
  ExternalLink,
  FileArchive,
  FileJson,
  FileText,
  Loader2,
  Map,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react'
import './App.css'
import { createExportZip, createJupyterNotebook, createQuartoNotebook } from './lib/exportPackage'
import { countryLabel, parseCountryList } from './lib/regions'
import type {
  AnalysisType,
  CountBucket,
  DataPreview,
  GbifQuery,
  PreferredLanguage,
  Risk,
  StudyIntent,
  TaxonResolution,
  TriageResult,
  WorkflowPackage,
} from './lib/types'

type WorkflowTab = 'r' | 'python' | 'sql' | 'predicate' | 'cleaning' | 'methods' | 'citation' | 'limitations'

const ANALYSIS_OPTIONS: { value: AnalysisType; label: string }[] = [
  { value: 'unknown', label: 'Let StudyScout infer' },
  { value: 'range_shift_exploration', label: 'Range-shift exploration' },
  { value: 'species_distribution_modelling', label: 'Species distribution modelling' },
  { value: 'distribution_mapping', label: 'Distribution mapping' },
  { value: 'temporal_trend_or_abundance', label: 'Trend / abundance triage' },
  { value: 'invasive_monitoring_preview', label: 'Invasive monitoring preview' },
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

type Status = 'idle' | 'interpreting' | 'previewing' | 'ready' | 'error'

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
      const message = caught instanceof Error ? caught.message : 'StudyScout interpretation failed.'
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
      const message = caught instanceof Error ? caught.message : 'StudyScout analysis failed.'
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

  const topRisk = triage?.risks.find((risk) => risk.level === 'BLOCKING' || risk.level === 'HIGH')

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#workspace" aria-label="GBIF StudyScout workspace">
          <span className="brand-mark">S</span>
          <span>
            <strong>GBIF StudyScout</strong>
            <small>Pre-download research triage</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#workspace">Workspace</a>
          <a href="#method">Method</a>
          <a href="#exports">Exports</a>
        </nav>
        <button className="topbar-action" type="button" onClick={analyze} disabled={isBusy || !question.trim()}>
          {isBusy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
          Start plan
        </button>
      </header>

      <main id="workspace">
        <section className="hero-band">
          <div>
            <h1>Plan your GBIF study before you download data.</h1>
            <p>
              Turn a biodiversity research question into a cautious GBIF data-use plan with live availability checks,
              bias warnings, and reproducible workflow files.
            </p>
          </div>
          <div className="hero-status" aria-live="polite">
            <span className={`status-dot ${status}`}></span>
            <span>{statusText(status, preview, topRisk)}</span>
          </div>
        </section>

        <section className="workbench" aria-label="StudyScout workbench">
          <aside className="panel input-panel">
            <PanelHeader icon={<Search size={18} />} title="Study idea" subtitle="Natural language in, structured plan out" />
            <label className="field-label" htmlFor="question">
              What do you want to study using GBIF-mediated data?
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(event) => changeQuestion(event.target.value)}
              rows={8}
              spellCheck
              placeholder="Describe the research question, taxon, place, time period, and intended analysis."
            />
            <div className="prompt-row" aria-label="Demo prompts">
              {DEMO_PROMPTS.map((prompt) => (
                <button key={prompt.question} type="button" onClick={() => selectDemoPrompt(prompt.question)} disabled={isBusy}>
                  <span>{prompt.label}</span>
                  <small>{prompt.question}</small>
                </button>
              ))}
            </div>

            <div className="advanced-grid">
              <Field label="Taxon">
                <input value={draftTaxon} onChange={(event) => setDraftTaxon(event.target.value)} placeholder="Optional taxon override" />
              </Field>
              <Field label="Region">
                <input value={draftRegion} onChange={(event) => setDraftRegion(event.target.value)} placeholder="Optional region override" />
              </Field>
              <Field label="Years">
                <input value={draftYears} onChange={(event) => setDraftYears(event.target.value)} placeholder="YYYY-YYYY" />
              </Field>
              <Field label="Intended analysis">
                <select value={draftAnalysis} onChange={(event) => setDraftAnalysis(event.target.value as AnalysisType)}>
                  {ANALYSIS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Spatial resolution">
                <select value={draftSpatialResolution} onChange={(event) => setDraftSpatialResolution(event.target.value)}>
                  <option value="">Let StudyScout infer</option>
                  <option>Local / fine-scale</option>
                  <option>Country or regional</option>
                  <option>Continental or broad-scale</option>
                </select>
              </Field>
              <Field label="Skill level">
                <select value={draftSkillLevel} onChange={(event) => setDraftSkillLevel(event.target.value)}>
                  <option value="">Let StudyScout infer</option>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </Field>
              <Field label="Code output">
                <select value={preferredLanguage} onChange={(event) => setPreferredLanguage(event.target.value as PreferredLanguage)}>
                  <option>Both</option>
                  <option>R</option>
                  <option>Python</option>
                </select>
              </Field>
            </div>

            <button className="secondary-button" type="button" onClick={interpretScope} disabled={isBusy || !question.trim()}>
              {isBusy ? <Loader2 className="spin" size={18} /> : <ClipboardList size={18} />}
              Interpret scope first
            </button>
            <button className="primary-button" type="button" onClick={analyze} disabled={isBusy || !question.trim()}>
              {isBusy ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
              Analyze study idea
            </button>

            {error && (
              <div className="error-box" role="alert">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            <InterpretationPanel
              intent={intent}
              taxon={taxon}
              onChange={updateIntent}
              onCountriesChange={updateCountries}
              onRefresh={() => rerunEditedScope()}
              isBusy={isBusy}
            />
          </aside>

          <section className="panel preview-panel">
            <PanelHeader icon={<Database size={18} />} title="GBIF data preview" subtitle="Aggregated search facets, not a full download" />
            {preview ? <DataPreviewPanel preview={preview} /> : <EmptyState title="No preview yet" body="Run a study idea to fetch live GBIF counts, facets, and sample records." />}
          </section>

          <aside className="panel triage-panel">
            <PanelHeader icon={<ShieldAlert size={18} />} title="Triage and workflow" subtitle="Separate availability, suitability, and claim strength" />
            {triage && preview && workflow && query ? (
              <>
                <SupportPanel triage={triage} />
                <RiskPanel risks={triage.risks} />
                <WorkflowPanel
                  workflow={workflow}
                  query={query}
                  triage={triage}
                  activeTab={activeWorkflowTab}
                  setActiveTab={setActiveWorkflowTab}
                />
              </>
            ) : (
              <EmptyState title="Awaiting triage" body="StudyScout will classify supported, conditional, and unsupported claims after live analysis completes." />
            )}
          </aside>
        </section>

        <section className="method-band" id="method">
          <div>
            <h2>Scientific guardrail</h2>
            <p>
              StudyScout does not certify data as valid. It summarizes GBIF-mediated data availability and common data-use
              risks for a proposed research question. Final suitability depends on method choice, taxon expertise, scale,
              and additional data sources.
            </p>
          </div>
          <div className="method-points">
            <span>OpenAI structured outputs</span>
            <span>Official GBIF identifiers</span>
            <span>DOI-backed download guidance</span>
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
    throw new Error(body?.error || `StudyScout API failed with status ${response.status}`)
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
    throw new Error(body?.error || `StudyScout API failed with status ${response.status}`)
  }

  return (await response.json()) as IntentResponse
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
    <div className="interpretation-card">
      <div className="subhead">
        <ClipboardList size={17} />
        <span>Interpreted study</span>
      </div>
      <Field label="Taxon">
        <input
          value={intent.taxonText}
          onChange={(event) => onChange({ taxonText: event.target.value, taxonQuery: event.target.value })}
        />
      </Field>
      <Field label="Region">
        <input value={intent.regionText} onChange={(event) => onChange({ regionText: event.target.value })} />
      </Field>
      <Field label="Countries">
        <input value={intent.countries.join(', ')} onChange={(event) => onCountriesChange(event.target.value)} placeholder="ISO country codes" />
      </Field>
      <div className="two-fields">
        <Field label="Start">
          <input
            inputMode="numeric"
            value={intent.startYear ?? ''}
            onChange={(event) => onChange({ startYear: numberOrNull(event.target.value) })}
          />
        </Field>
        <Field label="End">
          <input
            inputMode="numeric"
            value={intent.endYear ?? ''}
            onChange={(event) => onChange({ endYear: numberOrNull(event.target.value) })}
          />
        </Field>
      </div>
      <Field label="Analysis">
        <select value={intent.analysisType} onChange={(event) => onChange({ analysisType: event.target.value as AnalysisType })}>
          {ANALYSIS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Spatial resolution">
        <input value={intent.spatialResolution} onChange={(event) => onChange({ spatialResolution: event.target.value })} />
      </Field>
      <Field label="Skill level">
        <input value={intent.skillLevel} onChange={(event) => onChange({ skillLevel: event.target.value })} />
      </Field>
      {taxon && (
        <div className="taxon-resolution">
          <CheckCircle2 size={16} />
          <span>
            {taxon.scientificName} · {taxon.rank} · confidence {taxon.confidence}
          </span>
        </div>
      )}
      {intent.ambiguities.length > 0 && (
        <ul className="ambiguities">
          {intent.ambiguities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <button className="secondary-button" type="button" onClick={onRefresh} disabled={isBusy}>
        {isBusy ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
        Run live preview
      </button>
    </div>
  )
}

function DataPreviewPanel({ preview }: { preview: DataPreview }) {
  return (
    <div className="preview-stack">
      {preview.warnings.map((warning) => (
        <div key={warning} className="warning-box">
          <AlertTriangle size={16} />
          <span>{warning}</span>
        </div>
      ))}
      <div className="metric-grid">
        <Metric label="Matching records" value={formatNumber(preview.counts.total)} />
        <Metric label="With coordinates" value={formatNumber(preview.counts.withCoordinates)} />
        <Metric label="Usable coordinates" value={formatNumber(preview.counts.withUsableCoordinates)} />
        <Metric label="Coordinates + date" value={formatNumber(preview.counts.withCoordinatesAndDate)} />
      </div>
      <MapPreview points={preview.samplePoints} />
      <div className="chart-grid">
        <Histogram title="Records by year" buckets={preview.facets.years} />
        <BarList title="Country distribution" buckets={preview.facets.countries.slice(0, 8)} formatter={countryLabel} />
      </div>
      <div className="chart-grid">
        <BarList title="Basis of record" buckets={preview.facets.basisOfRecord} />
        <BarList
          title="Top datasets"
          buckets={preview.facets.datasets.slice(0, 6).map((dataset) => ({ name: dataset.title ?? dataset.name, count: dataset.count }))}
        />
      </div>
      <div className="chart-grid">
        <BarList title="Taxonomic breakdown" buckets={preview.facets.taxa.slice(0, 8)} />
        <BarList title="GBIF issues and flags" buckets={preview.facets.issues.slice(0, 8)} formatter={formatIssueName} />
      </div>
      <div className="sampling-box">
        <strong>Coordinate uncertainty</strong>
        <span>
          {formatNumber(preview.coordinateUncertainty.recordsWithUncertainty)} of{' '}
          {formatNumber(preview.coordinateUncertainty.sampledRecords)} sampled records report uncertainty.
        </span>
        <small>
          Median uncertainty:{' '}
          {preview.coordinateUncertainty.medianMeters === null
            ? 'not reported'
            : `${formatNumber(preview.coordinateUncertainty.medianMeters)} m`}
          ; over 10 km:{' '}
          {new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(
            preview.coordinateUncertainty.over10kmShare,
          )}
          .
        </small>
      </div>
      <div className="sampling-box">
        <strong>Sampling-event discovery</strong>
        <span>
          {formatNumber(preview.samplingEvents.datasetHits)} dataset hits checked across{' '}
          {preview.samplingEvents.countriesChecked.length ? preview.samplingEvents.countriesChecked.join(', ') : 'global GBIF'}.
        </span>
        <small>{preview.samplingEvents.note}</small>
      </div>
    </div>
  )
}

function SupportPanel({ triage }: { triage: TriageResult }) {
  return (
    <section className="support-box">
      <span className="support-label">Can GBIF support this study?</span>
      <h2>{triage.support.headline}</h2>
      <div className="readiness-grid">
        <Readiness label="Spatial" value={triage.readiness.spatial} />
        <Readiness label="Temporal" value={triage.readiness.temporal} />
        <Readiness label="Taxonomic" value={triage.readiness.taxonomic} />
        <Readiness label="Data type" value={triage.readiness.dataType} />
      </div>
      <SupportGroup title="Strongly supported" items={triage.support.stronglySupported} tone="good" />
      <SupportGroup title="Conditionally supported" items={triage.support.conditionallySupported} tone="caution" />
      <SupportGroup title="Exploratory only" items={triage.support.exploratoryOnly} tone="caution" />
      <SupportGroup title="Not supported by occurrence-only data" items={triage.support.notSupportedWithOccurrenceOnly} tone="danger" />
      <SupportGroup title="Insufficient data" items={triage.support.insufficientData} tone="danger" />
      <SupportGroup title="Unsupported claims" items={triage.unsupportedClaims} tone="danger" />
      <SupportGroup title="What to do next" items={triage.nextSteps} tone="good" />
    </section>
  )
}

function RiskPanel({ risks }: { risks: Risk[] }) {
  const sorted = [...risks].sort((a, b) => riskWeight(b.level) - riskWeight(a.level))
  return (
    <section className="risk-list">
      <div className="subhead">
        <AlertTriangle size={17} />
        <span>Bias and limitation checks</span>
      </div>
      {sorted.map((risk) => (
        <article key={`${risk.category}-${risk.title}`} className={`risk-card ${risk.level.toLowerCase()}`}>
          <div className="risk-card-head">
            <strong>{risk.title}</strong>
            <span>{risk.level}</span>
          </div>
          <p>{risk.explanation}</p>
          <dl>
            <dt>Evidence</dt>
            <dd>{risk.evidence}</dd>
            <dt>Why it matters</dt>
            <dd>{risk.whyItMatters}</dd>
            <dt>Mitigation</dt>
            <dd>{risk.recommendedMitigation}</dd>
            {risk.relatedWorkflowStep && (
              <>
                <dt>Workflow step</dt>
                <dd>{risk.relatedWorkflowStep}</dd>
              </>
            )}
          </dl>
        </article>
      ))}
    </section>
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
    <section className="workflow-box" id="exports">
      <div className="subhead">
        <Code2 size={17} />
        <span>Generated workflow</span>
      </div>
      <FilterSummary query={query} recommendedFilters={triage.recommendedFilters} />
      <div className="query-links">
        <a href={query.gbifSearchUrl} target="_blank" rel="noreferrer">
          GBIF.org search <ExternalLink size={13} />
        </a>
        <a href={query.apiSearchUrl} target="_blank" rel="noreferrer">
          API preview <ExternalLink size={13} />
        </a>
      </div>
      <div className="tab-row" role="tablist" aria-label="Workflow output tabs">
        <TabButton active={activeTab === 'r'} onClick={() => setActiveTab('r')}>
          R
        </TabButton>
        <TabButton active={activeTab === 'python'} onClick={() => setActiveTab('python')}>
          Python
        </TabButton>
        <TabButton active={activeTab === 'sql'} onClick={() => setActiveTab('sql')}>
          SQL
        </TabButton>
        <TabButton active={activeTab === 'predicate'} onClick={() => setActiveTab('predicate')}>
          Predicate
        </TabButton>
        <TabButton active={activeTab === 'cleaning'} onClick={() => setActiveTab('cleaning')}>
          Cleaning
        </TabButton>
        <TabButton active={activeTab === 'methods'} onClick={() => setActiveTab('methods')}>
          Methods
        </TabButton>
        <TabButton active={activeTab === 'citation'} onClick={() => setActiveTab('citation')}>
          Citation
        </TabButton>
        <TabButton active={activeTab === 'limitations'} onClick={() => setActiveTab('limitations')}>
          Limitations
        </TabButton>
      </div>
      <pre className="code-block">
        <code>{tabContent}</code>
      </pre>
      <div className="export-grid">
        <ExportButton icon={<FileText size={16} />} label="Markdown" filename="studyscout-plan.md" content={workflow.markdownReport} />
        <ExportButton icon={<FileJson size={16} />} label="JSON" filename="studyscout-plan.json" content={workflow.jsonPlan} type="application/json" />
        <ExportButton icon={<Braces size={16} />} label="HTML" filename="studyscout-report.html" content={workflow.htmlReport} type="text/html" />
        <ExportButton icon={<FileText size={16} />} label="Quarto" filename="studyscout-workflow.qmd" content={createQuartoNotebook(workflow)} />
        <ExportButton icon={<Database size={16} />} label="SQL" filename="gbif-occurrence-cube.sql" content={workflow.sqlCode} />
        <ExportButton
          icon={<FileJson size={16} />}
          label="Predicate"
          filename="gbif-download-request.json"
          content={workflow.downloadRequestJson}
          type="application/json"
        />
        <ExportButton
          icon={<FileJson size={16} />}
          label="Jupyter"
          filename="studyscout-workflow.ipynb"
          content={createJupyterNotebook(workflow)}
          type="application/json"
        />
        <ZipButton workflow={workflow} />
      </div>
    </section>
  )
}

function FilterSummary({ query, recommendedFilters }: { query: GbifQuery; recommendedFilters: string[] }) {
  const apiFilters = Object.entries(query.apiParams)
  return (
    <section className="filter-summary" aria-label="GBIF filters">
      <strong>GBIF filters</strong>
      <div>
        {apiFilters.map(([key, value]) => (
          <span key={key}>
            {formatFilterName(key)}: {formatFilterValue(value)}
          </span>
        ))}
      </div>
      {recommendedFilters.length > 0 && (
        <>
          <strong>Recommended filters</strong>
          <ul>
            {recommendedFilters.map((filter) => (
              <li key={filter}>{filter}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function MapPreview({ points }: { points: { lat: number; lon: number }[] }) {
  const projected = useMemo(
    () =>
      points.slice(0, 220).map((point) => ({
        x: ((point.lon + 180) / 360) * 100,
        y: ((90 - point.lat) / 180) * 100,
      })),
    [points],
  )

  return (
    <figure className="map-preview" aria-label="Sample occurrence map preview">
      <figcaption>
        <Map size={16} />
        Sample georeferenced records
      </figcaption>
      <svg viewBox="0 0 100 52" role="img" aria-label={`${projected.length} sampled occurrence points plotted on a world grid`}>
        <rect x="0" y="0" width="100" height="52" rx="4" />
        {[20, 40, 60, 80].map((x) => (
          <line key={`x-${x}`} x1={x} x2={x} y1="0" y2="52" />
        ))}
        {[13, 26, 39].map((y) => (
          <line key={`y-${y}`} y1={y} y2={y} x1="0" x2="100" />
        ))}
        {projected.map((point, index) => (
          <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="0.8" />
        ))}
      </svg>
    </figure>
  )
}

function Histogram({ title, buckets }: { title: string; buckets: CountBucket[] }) {
  const visible = buckets.slice(-28)
  const max = Math.max(1, ...visible.map((bucket) => bucket.count))
  return (
    <section className="mini-chart">
      <h3>{title}</h3>
      <div className="histogram">
        {visible.map((bucket) => (
          <span
            key={bucket.name}
            title={`${bucket.name}: ${formatNumber(bucket.count)}`}
            style={{ height: `${Math.max(5, (bucket.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <small>
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
    <section className="mini-chart">
      <h3>{title}</h3>
      <div className="bar-list">
        {buckets.length ? (
          buckets.map((bucket) => (
            <div key={bucket.name} className="bar-row">
              <span>{formatter(bucket.name)}</span>
              <div>
                <i style={{ width: `${Math.max(4, (bucket.count / max) * 100)}%` }} />
              </div>
              <em>{formatNumber(bucket.count)}</em>
            </div>
          ))
        ) : (
          <small>No facet values returned.</small>
        )}
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Readiness({ label, value }: { label: string; value: number }) {
  return (
    <div className="readiness">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="16" />
        <circle cx="20" cy="20" r="16" style={{ strokeDasharray: `${value} 100` }} />
      </svg>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SupportGroup({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'caution' | 'danger' }) {
  if (!items.length) return null
  return (
    <div className={`support-group ${tone}`}>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
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
    <button type="button" onClick={() => downloadBlob(filename, new Blob([content], { type }))}>
      {icon}
      {label}
    </button>
  )
}

function ZipButton({ workflow }: { workflow: WorkflowPackage }) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        setLoading(true)
        try {
          const blob = await createExportZip(workflow)
          downloadBlob('studyscout-export.zip', blob)
        } finally {
          setLoading(false)
        }
      }}
    >
      {loading ? <Loader2 className="spin" size={16} /> : <FileArchive size={16} />}
      ZIP
    </button>
  )
}

function PanelHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="panel-header">
      <div className="panel-icon">{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <Download size={22} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={active} className={active ? 'active' : ''} onClick={onClick}>
      {children}
    </button>
  )
}

function parseYearRange(value: string) {
  const match = value.match(/(18\d{2}|19\d{2}|20\d{2})\s*(?:-|–|—|to|through)?\s*(18\d{2}|19\d{2}|20\d{2})?/)
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

function riskWeight(level: string) {
  return { BLOCKING: 5, HIGH: 4, MODERATE: 3, UNKNOWN: 2, LOW: 1 }[level as keyof Record<string, number>] ?? 0
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

export default App
