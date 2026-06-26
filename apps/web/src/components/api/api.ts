import type {
  AnalysisModels,
  DataPreview,
  GbifQuery,
  StudyIntent,
  TaxonResolution,
  TriageResult,
  WorkflowPackage,
} from '@/lib/types'

interface StudyPlanResponse {
  intent: StudyIntent
  taxon: TaxonResolution
  query: GbifQuery
  preview: DataPreview
  triage: TriageResult
  models?: AnalysisModels
}

interface WorkflowResponse {
  workflow: WorkflowPackage
  model?: string
}

export interface StudyPlanRequest {
  question: string
  overrides: Record<string, unknown>
}

export interface WorkflowRequest {
  intent: StudyIntent
  taxon: TaxonResolution
  query: GbifQuery
  preview: DataPreview
  triage: TriageResult | null
  models?: AnalysisModels
}

interface IntentResponse {
  intent: StudyIntent
}

export type AuthTokenGetter = () => Promise<string | null>

export async function requestStudyPlan(payload: StudyPlanRequest, getAuthToken: AuthTokenGetter): Promise<StudyPlanResponse> {
  const response = await authenticatedFetch('/api/study-plan', getAuthToken, {
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

// Fetches the long-form workflow code + reports. This is the slow half
// of the old combined endpoint — /api/workflow has its own 60s budget
// and runs in the background so the user sees the result card while
// the workflow streams in. Pass an AbortSignal to cancel when the
// user re-runs the analysis with a different scope.
export async function requestStudyWorkflow(
  payload: WorkflowRequest,
  getAuthToken: AuthTokenGetter,
  signal?: AbortSignal,
): Promise<WorkflowResponse> {
  const response = await authenticatedFetch('/api/workflow', getAuthToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `GBIF Workbench API failed with status ${response.status}`)
  }

  return (await response.json()) as WorkflowResponse
}

export async function requestStudyIntent(payload: StudyPlanRequest, getAuthToken: AuthTokenGetter): Promise<IntentResponse> {
  const response = await authenticatedFetch('/api/parse-intent', getAuthToken, {
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

async function authenticatedFetch(input: string, getAuthToken: AuthTokenGetter, init: RequestInit) {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Sign in with Google to run GBIF Workbench analysis.')
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
