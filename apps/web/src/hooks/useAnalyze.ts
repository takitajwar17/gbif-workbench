import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { friendlyError } from '@/lib/format'
import { detectOffTopicSentinel, validateResearchQuestion } from '@/lib/queryGuard'
import type { Status } from '@/lib/status'
import type { WorkflowGroup } from '@/constants/options'
import { useAppAuth } from '@/auth/auth-context'
import { requestStudyIntent, requestStudyPlan, requestStudyWorkflow } from '@/components/api/api'
import type { StudyPlanRequest } from '@/components/api/api'
import type {
  AnalysisModels,
  DataPreview,
  GbifQuery,
  HistorySnapshot,
  PreferredLanguage,
  StudyIntent,
  TaxonResolution,
  TriageResult,
  WorkflowPackage,
} from '@/lib/types'

const STALE_WORKFLOW_MESSAGE =
  'Scope changed after this run. Re-run the analysis to regenerate exports for the edited scope.'

// Single source of truth for the workspace's `useState` graph + the imperative
// actions that mutate it. The orchestrator (App.tsx) only renders JSX and
// forwards props; everything stateful lives here so each child component can
// receive a small, focused slice without prop-drilling through 14 levels.
//
// Flow (no auto-analysis anywhere — every API call requires an explicit click):
//   type in QuestionCard → changeQuestion()  (updates the textarea state only;
//                                              wipes stale results so the user
//                                              doesn't see data for the wrong question)
//   click Analyze study  → analyzeNow()  (interpretNow if no intent yet,
//                                          else runStudy with the existing intent)
//   edit a scope field   → updateIntentField()  (merge into intent locally;
//                                                sets scopeDirty so the UI can
//                                                prompt the user to Re-run)
//   click Re-run button  → analyzeNow()  (re-runs study with the edited intent)
//   click demo prompt    → selectDemoPrompt()  (set question text only — no API call)
//
// Two-endpoint flow (added with the /api/study-plan ↔ /api/workflow split):
//   runStudy fires /api/study-plan (intent + taxon + query + preview + triage).
//   When that resolves, the user sees the result card immediately. A separate
//   background call to /api/workflow then fetches the long-form code +
//   reports. We surface 'generating' status so the Export stepper badge
//   spins while that call is in flight. If /api/workflow fails (e.g.
//   60s timeout on Vercel Hobby), the result card stays usable and the
//   user gets a friendly error in the export panel — they can re-run.
//
// Scope field edits are LOCAL: they merge into intent but do NOT trigger a
// new study run. The user must press Re-run (or Analyze study) to apply.
// This keeps multi-field edits cheap — the user can refine five fields in a
// row without burning five LLM calls.
//
// Race protection: every async run increments a `runId`. Stale responses are
// dropped so a slow interpretation never overwrites a fresh one. The
// workflow call also carries an AbortController so a new run cancels the
// previous in-flight workflow fetch.

export function useAnalyze() {
  const auth = useAppAuth()
  const [question, setQuestion] = useState('')
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>('Both')
  const [intent, setIntent] = useState<StudyIntent | null>(null)
  const [taxon, setTaxon] = useState<TaxonResolution | null>(null)
  const [query, setQuery] = useState<GbifQuery | null>(null)
  const [preview, setPreview] = useState<DataPreview | null>(null)
  const [triage, setTriage] = useState<TriageResult | null>(null)
  const [workflow, setWorkflow] = useState<WorkflowPackage | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [workflowError, setWorkflowError] = useState('')
  const [error, setError] = useState('')
  const [activeWorkflowGroup, setActiveWorkflowGroup] = useState<WorkflowGroup>('code')
  const [activeCodeLanguage, setActiveCodeLanguage] = useState<'r' | 'python'>('r')
  const [activeWriteupTab, setActiveWriteupTab] = useState<'methods' | 'citation' | 'limitations'>('methods')
  const [activeQueryTab, setActiveQueryTab] = useState<'sql' | 'predicate'>('sql')
  // True when the user has edited the inline scope summary since the last
  // successful run. The UI surfaces this so the user knows the result pane
  // is showing data from the previous run.
  const [scopeDirty, setScopeDirty] = useState(false)

  const isBusy = status === 'interpreting' || status === 'previewing' || status === 'generating'
  const topRisk = triage?.risks.find((risk) => risk.level === 'BLOCKING' || risk.level === 'HIGH')
  const hasResults = Boolean(intent || taxon || preview || triage || workflow || error)

  // The question that was last submitted to the API. Used to skip re-running
  // interpretation when the user hasn't actually changed anything.
  const lastSubmittedRef = useRef('')
  // Monotonic counter incremented on every async kick-off. Stale responses
  // are discarded by checking this against the value at kick-off time.
  const runIdRef = useRef(0)
  // AbortController for the in-flight /api/workflow call. A new run cancels
  // the previous one so the user never sees a workflow that belongs to the
  // previous scope land on the current scope.
  const workflowAbortRef = useRef<AbortController | null>(null)
  const pendingAnalyzeAfterSignInRef = useRef(false)
  const analyzeNowRef = useRef<() => Promise<void> | void>(() => undefined)
  // Cancel any in-flight /api/workflow call. Called from runStudy before
  // it starts and from every result-clearing action so a stale workflow
  // never lands after the user has wiped the state.
  const cancelWorkflow = useCallback(() => {
    if (workflowAbortRef.current) {
      workflowAbortRef.current.abort()
      workflowAbortRef.current = null
    }
  }, [])

  function invalidateCurrentRun() {
    cancelWorkflow()
    runIdRef.current += 1
  }

  function requireSignedInForAnalysis() {
    if (auth.isSignedIn) return true
    if (!auth.isConfigured) {
      pendingAnalyzeAfterSignInRef.current = false
      setError('Authentication is not configured. Add Clerk keys to run live GBIF Workbench analysis.')
      setStatus('error')
      return false
    }
    if (!auth.isLoaded) {
      pendingAnalyzeAfterSignInRef.current = true
      return false
    }
    pendingAnalyzeAfterSignInRef.current = true
    auth.requestSignIn()
    return false
  }

  function markScopeEdited() {
    invalidateCurrentRun()
    setWorkflow(null)
    setWorkflowError(STALE_WORKFLOW_MESSAGE)
    if (status === 'interpreting' || status === 'previewing' || status === 'generating') {
      setStatus(preview || triage ? 'ready' : 'idle')
    }
  }

  async function runStudy(payload: StudyPlanRequest, runId: number) {
    const trimmedQuestion = payload.question.trim()
    if (!trimmedQuestion) return

    cancelWorkflow()
    setError('')
    setWorkflowError('')
    setStatus('previewing')
    setTaxon(null)
    setPreview(null)
    setTriage(null)
    setWorkflow(null)

    try {
      const result = await requestStudyPlan({ ...payload, question: trimmedQuestion }, auth.getAuthToken)
      if (runId !== runIdRef.current) return // stale response, ignore
      // Render the result card immediately. The /api/workflow call runs
      // in the background — the user does not have to wait for the long
      // LLM call to read the result card.
      setStatus('generating')
      startTransition(() => {
        setIntent(result.intent)
        setTaxon(result.taxon)
        setQuery(result.query)
        setPreview(result.preview)
        setTriage(result.triage)
      })
      lastSubmittedRef.current = trimmedQuestion
      setScopeDirty(false)
      // Fire-and-forget the workflow call. We intentionally do NOT await
      // it here — the user sees the result card while the workflow
      // streams in behind it. Errors are caught and surfaced as a
      // workflow-only error so the result card stays usable.
      void runWorkflow({
        intent: result.intent,
        taxon: result.taxon,
        query: result.query,
        preview: result.preview,
        triage: result.triage,
        models: result.models,
        runId,
      })
    } catch (caught) {
      if (runId !== runIdRef.current) return
      const raw = caught instanceof Error ? caught.message : 'GBIF Workbench analysis failed.'
      setError(friendlyError(raw, 'GBIF Workbench analysis failed.'))
      setStatus('error')
    }
  }

  // Background fetch for the long-form workflow code + reports. Never
  // throws to the caller — errors are surfaced via setWorkflowError so
  // the result card stays usable even when /api/workflow fails.
  async function runWorkflow({
    intent,
    taxon,
    query,
    preview,
    triage,
    models,
    runId,
  }: {
    intent: StudyIntent
    taxon: TaxonResolution
    query: GbifQuery
    preview: DataPreview
    triage: TriageResult
    models?: AnalysisModels
    runId: number
  }) {
    const controller = new AbortController()
    workflowAbortRef.current = controller
    try {
      const result = await requestStudyWorkflow(
        { intent, taxon, query, preview, triage, models },
        auth.getAuthToken,
        controller.signal,
      )
      if (runId !== runIdRef.current) return // stale response, ignore
      if (controller.signal.aborted) return
      startTransition(() => {
        setWorkflow(result.workflow)
        setWorkflowError('')
      })
      setStatus('ready')
    } catch (caught) {
      if (runId !== runIdRef.current) return
      if (controller.signal.aborted) return
      const raw =
        caught instanceof Error
          ? caught.message
          : 'GBIF Workbench workflow generation failed.'
      setWorkflowError(friendlyError(raw, 'GBIF Workbench workflow generation failed.'))
      // The result card is still usable — drop the 'generating' status so
      // the stepper Export step moves out of loading. The user can re-run
      // to retry just the workflow.
      setStatus('ready')
    } finally {
      if (workflowAbortRef.current === controller) {
        workflowAbortRef.current = null
      }
    }
  }

  async function interpretNow() {
    const trimmed = question.trim()
    if (!trimmed) return
    const validation = validateResearchQuestion(trimmed)
    if (!validation.ok) {
      // Reject early — no API call, no LLM token, no spinner flash.
      invalidateCurrentRun()
      setIntent(null)
      setTaxon(null)
      setQuery(null)
      setPreview(null)
      setTriage(null)
      setWorkflow(null)
      setWorkflowError('')
      setError(validation.message)
      setStatus('error')
      lastSubmittedRef.current = ''
      return
    }
    if (trimmed === lastSubmittedRef.current && intent) return // nothing changed

    invalidateCurrentRun()
    const runId = runIdRef.current

    setError('')
    setWorkflowError('')
    setStatus('interpreting')
    setTaxon(null)
    setPreview(null)
    setTriage(null)
    setWorkflow(null)

    try {
      const result = await requestStudyIntent({ question: trimmed, overrides: { preferredLanguage } }, auth.getAuthToken)
      if (runId !== runIdRef.current) return
      // LLM-side off-topic check: if the model couldn't make sense of the
      // question as a biodiversity / GBIF data request, it sets a sentinel
      // ambiguity. Surface that as a friendly rejection instead of feeding
      // a junk intent into the study pipeline.
      if (detectOffTopicSentinel(result.intent.ambiguities)) {
        setIntent(null)
        setStatus('error')
        setError(
          'This question does not look like a GBIF / biodiversity data study. ' +
            'Try asking where a species occurs, how its range is shifting, what its ' +
            'GBIF records look like over time, or how abundant it is in a region.',
        )
        lastSubmittedRef.current = ''
        return
      }
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
    const validation = validateResearchQuestion(trimmed)
    if (!validation.ok) {
      invalidateCurrentRun()
      setIntent(null)
      setTaxon(null)
      setQuery(null)
      setPreview(null)
      setTriage(null)
      setWorkflow(null)
      setWorkflowError('')
      setError(validation.message)
      setStatus('error')
      lastSubmittedRef.current = ''
      return
    }
    if (!requireSignedInForAnalysis()) return
    if (intent) {
      invalidateCurrentRun()
      await runStudy({ question: trimmed, overrides: { ...intent, preferredLanguage } }, runIdRef.current)
    } else {
      await interpretNow()
    }
  }

  function changeQuestion(value: string) {
    setQuestion(value)
    // Wipe stale results as soon as the user starts editing — the previous
    // run's data no longer matches the question being typed. We do NOT
    // kick off any analysis here; the user must click Analyze study to
    // run a new study.
    if (
      status !== 'idle' ||
      intent ||
      taxon ||
      query ||
      preview ||
      triage ||
      workflow ||
      workflowError ||
      error ||
      scopeDirty
    ) {
      invalidateCurrentRun()
      setIntent(null)
      setTaxon(null)
      setQuery(null)
      setPreview(null)
      setTriage(null)
      setWorkflow(null)
      setWorkflowError('')
      setError('')
      setStatus('idle')
      lastSubmittedRef.current = ''
      setScopeDirty(false)
    }
  }

  function updateIntentField<K extends keyof StudyIntent>(key: K, value: StudyIntent[K]) {
    // Edits to the inline scope summary are local until the user explicitly
    // presses the Re-run button (or Analyze study). This lets users refine
    // multiple fields without burning an LLM call per keystroke.
    markScopeEdited()
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

  function changePreferredLanguage(value: PreferredLanguage) {
    setPreferredLanguage(value)
    if (intent) {
      markScopeEdited()
      setScopeDirty(true)
    }
  }

  function selectDemoPrompt(prompt: string) {
    pendingAnalyzeAfterSignInRef.current = false
    invalidateCurrentRun()
    setQuestion(prompt)
    setIntent(null)
    setTaxon(null)
    setQuery(null)
    setPreview(null)
    setTriage(null)
    setWorkflow(null)
    setWorkflowError('')
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
    pendingAnalyzeAfterSignInRef.current = false
    invalidateCurrentRun()
    setIntent(null)
    setTaxon(null)
    setQuery(null)
    setPreview(null)
    setTriage(null)
    setWorkflow(null)
    setWorkflowError('')
    setError('')
    setStatus('idle')
    lastSubmittedRef.current = ''
    setScopeDirty(false)
  }

  function loadHistorySnapshot(snapshot: HistorySnapshot) {
    pendingAnalyzeAfterSignInRef.current = false
    invalidateCurrentRun()
    const restoredQuestion = String(snapshot.question || snapshot.intent?.question || '').trim()

    setQuestion(restoredQuestion)
    setPreferredLanguage(snapshot.preferredLanguage || snapshot.intent?.preferredLanguage || 'Both')
    setIntent(snapshot.intent)
    setTaxon(snapshot.taxon)
    setQuery(snapshot.query)
    setPreview(snapshot.preview)
    setTriage(snapshot.triage)
    setWorkflow(snapshot.workflow)
    setWorkflowError('')
    setError('')
    setStatus('ready')
    lastSubmittedRef.current = restoredQuestion
    setScopeDirty(false)
  }

  // Cleanup any in-flight workflow fetch on unmount.
  useEffect(() => {
    return () => {
      cancelWorkflow()
    }
  }, [cancelWorkflow])

  useEffect(() => {
    analyzeNowRef.current = analyzeNow
  })

  const authIsConfigured = auth.isConfigured
  const authIsLoaded = auth.isLoaded
  const authIsSignedIn = auth.isSignedIn
  const requestSignIn = auth.requestSignIn

  useEffect(() => {
    if (!pendingAnalyzeAfterSignInRef.current) return
    if (authIsSignedIn) {
      pendingAnalyzeAfterSignInRef.current = false
      void analyzeNowRef.current()
      return
    }
    if (authIsConfigured && authIsLoaded) {
      requestSignIn()
    }
  }, [authIsConfigured, authIsLoaded, authIsSignedIn, requestSignIn])

  return {
    question,
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
    workflowError,
    setWorkflowError,
    isBusy,
    preferredLanguage,
    setPreferredLanguage: changePreferredLanguage,
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
    loadHistorySnapshot,
  }
}
