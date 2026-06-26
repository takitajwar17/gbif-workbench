import type {
  AnalysisModels,
  DataPreview,
  GbifQuery,
  HistoryEntry,
  HistoryListItem,
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
  history?: {
    saved: boolean
    reason?: string
    item?: HistoryListItem
  }
}

interface WorkflowResponse {
  workflow: WorkflowPackage
  model?: string
  history?: {
    saved: boolean
    reason?: string
    item?: HistoryListItem
  }
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
  historyId?: string
}

interface IntentResponse {
  intent: StudyIntent
}

export type AuthTokenGetter = () => Promise<string | null>

interface HistoryListResponse {
  items: HistoryListItem[]
}

interface HistoryEntryResponse {
  item: HistoryEntry
}

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

export async function requestHistoryList(getAuthToken: AuthTokenGetter): Promise<HistoryListItem[]> {
  const response = await authenticatedFetch('/api/history?limit=50', getAuthToken, {
    method: 'GET',
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `GBIF Workbench history failed with status ${response.status}`)
  }

  const body = (await response.json()) as HistoryListResponse
  return body.items
}

export async function requestHistoryEntry(id: string, getAuthToken: AuthTokenGetter): Promise<HistoryEntry> {
  const response = await authenticatedFetch(`/api/history?id=${encodeURIComponent(id)}`, getAuthToken, {
    method: 'GET',
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `GBIF Workbench history failed with status ${response.status}`)
  }

  const body = (await response.json()) as HistoryEntryResponse
  return body.item
}

export async function deleteHistoryEntry(id: string, getAuthToken: AuthTokenGetter): Promise<void> {
  const response = await authenticatedFetch(`/api/history?id=${encodeURIComponent(id)}`, getAuthToken, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `GBIF Workbench history delete failed with status ${response.status}`)
  }
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
