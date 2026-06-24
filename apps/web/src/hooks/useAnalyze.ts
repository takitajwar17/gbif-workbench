import { startTransition, useState } from 'react'
import { parseCountryList } from '@/lib/regions'
import { parseYearRange } from '@/lib/format'
import type { Status } from '@/lib/status'
import type { WorkflowGroup } from '@/constants/options'
import { requestStudyIntent, requestStudyPlan } from '@/components/api/api'
import type { StudyPlanRequest } from '@/components/api/api'
import type {
  AnalysisType,
  DataPreview,
  GbifQuery,
  PreferredLanguage,
  StudyIntent,
  TaxonResolution,
  TriageResult,
  WorkflowPackage,
} from '@/lib/types'

// Single source of truth for the workspace's `useState` graph + the imperative
// actions that mutate it. The orchestrator (App.tsx) only renders JSX and
// forwards props; everything stateful lives here so each child component can
// receive a small, focused slice without prop-drilling through 14 levels.

export function useAnalyze() {
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

  return {
    question,
    setQuestion,
    intent,
    setIntent,
    taxon,
    setTaxon,
    query,
    setQuery,
    preview,
    setPreview,
    triage,
    setTriage,
    workflow,
    setWorkflow,
    status,
    setStatus,
    error,
    setError,
    isBusy,
    draftTaxon,
    setDraftTaxon,
    draftRegion,
    setDraftRegion,
    draftYears,
    setDraftYears,
    draftAnalysis,
    setDraftAnalysis,
    draftSpatialResolution,
    setDraftSpatialResolution,
    draftSkillLevel,
    setDraftSkillLevel,
    preferredLanguage,
    setPreferredLanguage,
    activeWorkflowGroup,
    setActiveWorkflowGroup,
    activeCodeLanguage,
    setActiveCodeLanguage,
    activeWriteupTab,
    setActiveWriteupTab,
    activeQueryTab,
    setActiveQueryTab,
    topRisk,
    selectDemoPrompt,
    changeQuestion,
    interpretScope,
    analyze,
    rerunEditedScope,
    runStudy,
    updateIntent,
    updateCountries,
    clearResults,
  }
}