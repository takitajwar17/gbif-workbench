import type { DataPreview, GbifQuery, StudyIntent, TaxonResolution, TriageResult, WorkflowPackage } from '@/lib/types'

interface StudyPlanResponse {
  intent: StudyIntent
  taxon: TaxonResolution
  query: GbifQuery
  preview: DataPreview
  triage: TriageResult
  workflow: WorkflowPackage
}

export interface StudyPlanRequest {
  question: string
  overrides: Record<string, unknown>
}

interface IntentResponse {
  intent: StudyIntent
}

export async function requestStudyPlan(payload: StudyPlanRequest): Promise<StudyPlanResponse> {
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

export async function requestStudyIntent(payload: StudyPlanRequest): Promise<IntentResponse> {
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