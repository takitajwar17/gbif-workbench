import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { friendlyError } from '@/lib/format'
import type { Status } from '@/lib/status'
import type { WorkflowGroup } from '@/constants/options'
import { requestStudyIntent, requestStudyPlan } from '@/components/api/api'
import type { StudyPlanRequest } from '@/components/api/api'
import type {
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
//
// Flow:
//   type in QuestionCard → debounced 600ms → interpretNow()  (intent only)
//                         → on intent set → runStudy()        (preview + triage + workflow)
//   click Analyze study  → analyzeNow()  (runStudy with current intent)
//   edit a scope field   → updateIntentField()  (merge into intent locally;
//                                                sets scopeDirty so the UI can
//                                                prompt the user to Re-run)
//   click Re-run button  → analyzeNow()  (re-runs study with the edited intent)
//   click demo prompt    → selectDemoPrompt()  (set question + interpretNow)
//
// Scope field edits are LOCAL: they merge into intent but do NOT trigger a
// new study run. The user must press Re-run (or Analyze study) to apply.
// This keeps multi-field edits cheap — the user can refine five fields in a
// row without burning five LLM calls.
//
// Race protection: every async run increments a `runId`. Stale responses are
// dropped so a slow interpretation never overwrites a fresh one.

const INTERPRET_DEBOUNCE_MS = 600

export function useAnalyze() {
  const [question, setQuestion] = useState('')
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
  // True when the user has edited the inline scope summary since the last
  // successful run. The UI surfaces this so the user knows the result pane
  // is showing data from the previous run.
  const [scopeDirty, setScopeDirty] = useState(false)

  const isBusy = status === 'interpreting' || status === 'previewing'
  const topRisk = triage?.risks.find((risk) => risk.level === 'BLOCKING' || risk.level === 'HIGH')
  const hasResults = Boolean(intent || taxon || preview || triage || workflow || error)

  // The question that was last submitted to the API. Used to skip re-running
  // interpretation when the user hasn't actually changed anything.
  const lastSubmittedRef = useRef('')
  // Monotonic counter incremented on every async kick-off. Stale responses
  // are discarded by checking this against the value at kick-off time.
  const runIdRef = useRef(0)
  // Debounce timer for the auto-interpret-on-type flow.
  const interpretTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (interpretTimerRef.current) {
      clearTimeout(interpretTimerRef.current)
      interpretTimerRef.current = null
    }
  }, [])

  async function runStudy(payload: StudyPlanRequest, runId: number) {
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
      if (runId !== runIdRef.current) return // stale response, ignore
      setStatus('ready')
      startTransition(() => {
        setIntent(result.intent)
        setTaxon(result.taxon)
        setQuery(result.query)
        setPreview(result.preview)
        setTriage(result.triage)
        setWorkflow(result.workflow)
      })
      lastSubmittedRef.current = trimmedQuestion
      setScopeDirty(false)
    } catch (caught) {
      if (runId !== runIdRef.current) return
      const raw = caught instanceof Error ? caught.message : 'GBIF Workbench analysis failed.'
      setError(friendlyError(raw, 'GBIF Workbench analysis failed.'))
      setStatus('error')
    }
  }

  async function interpretNow() {
    const trimmed = question.trim()
    if (!trimmed) return
    if (trimmed === lastSubmittedRef.current && intent) return // nothing changed

    runIdRef.current += 1
    const runId = runIdRef.current

    setError('')
    setStatus('interpreting')
    setTaxon(null)
    setPreview(null)
    setTriage(null)
    setWorkflow(null)

    try {
      const result = await requestStudyIntent({ question: trimmed, overrides: { preferredLanguage } })
      if (runId !== runIdRef.current) return
      setIntent(result.intent)
      setStatus('idle')
      // Auto-chain: as soon as the intent is in, fire the full study so the
      // preview/triage/workflow appear without a second button press.
      await runStudy({ question: trimmed, overrides: { ...result.intent, preferredLanguage } }, runId)
    } catch (caught) {
      if (runId !== runIdRef.current) return
      const raw = caught instanceof Error ? caught.message : 'GBIF Workbench interpretation failed.'
      setError(friendlyError(raw, 'GBIF Workbench interpretation failed.'))
      setStatus('error')
    }
  }

  // Explicit "run now" trigger. Used by the Analyze study button.
  async function analyzeNow() {
    const trimmed = question.trim()
    if (!trimmed) return
    clearTimers()
    if (intent) {
      runIdRef.current += 1
      await runStudy({ question: trimmed, overrides: { ...intent, preferredLanguage } }, runIdRef.current)
    } else {
      await interpretNow()
    }
  }

  function changeQuestion(value: string) {
    setQuestion(value)
    // Wipe stale results as soon as the user starts editing — the inline
    // scope summary will repopulate automatically once the new question is
    // interpreted.
    if (intent || taxon || preview || triage || workflow || error) {
      setIntent(null)
      setTaxon(null)
      setQuery(null)
      setPreview(null)
      setTriage(null)
      setWorkflow(null)
      setError('')
      setStatus('idle')
      lastSubmittedRef.current = ''
      setScopeDirty(false)
    }
    if (interpretTimerRef.current) clearTimeout(interpretTimerRef.current)
    const trimmed = value.trim()
    if (trimmed.length >= 6 && trimmed !== lastSubmittedRef.current) {
      interpretTimerRef.current = setTimeout(() => {
        interpretNow()
      }, INTERPRET_DEBOUNCE_MS)
    }
  }

  function updateIntentField<K extends keyof StudyIntent>(key: K, value: StudyIntent[K]) {
    // Edits to the inline scope summary are local until the user explicitly
    // presses the Re-run button (or Analyze study). This lets users refine
    // multiple fields without burning an LLM call per keystroke.
    setIntent((current) => {
      if (!current) return current
      // Keep taxonText + taxonQuery in sync when the user edits taxonText.
      const patch: Partial<StudyIntent> = { [key]: value } as Partial<StudyIntent>
      if (key === 'taxonText') patch.taxonQuery = String(value)
      return { ...current, ...patch }
    })
    setScopeDirty(true)
  }

  function updateCountries(value: string) {
    const codes = value
      .split(/[,\s]+/)
      .map((code) => code.trim().toUpperCase())
      .filter((code) => /^[A-Z]{2}$/.test(code))
    const deduped = Array.from(new Set(codes))
    updateIntentField('countries', deduped)
  }

  function selectDemoPrompt(prompt: string) {
    clearTimers()
    setQuestion(prompt)
    setIntent(null)
    setTaxon(null)
    setQuery(null)
    setPreview(null)
    setTriage(null)
    setWorkflow(null)
    setError('')
    // Demo prompts only fill the textarea — the user must press Analyze
    // study to actually run the study. No auto-interpret, no debounced
    // kick-off. Keeping the prompts visible while idle is the signal
    // that nothing has started yet.
    setStatus('idle')
    lastSubmittedRef.current = ''
    setScopeDirty(false)
  }

  function clearResults() {
    clearTimers()
    setIntent(null)
    setTaxon(null)
    setQuery(null)
    setPreview(null)
    setTriage(null)
    setWorkflow(null)
    setError('')
    setStatus('idle')
    lastSubmittedRef.current = ''
    setScopeDirty(false)
  }

  // Cleanup any pending timers on unmount.
  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

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
    hasResults,
    scopeDirty,
    selectDemoPrompt,
    changeQuestion,
    analyzeNow,
    updateIntentField,
    updateCountries,
    clearResults,
  }
}