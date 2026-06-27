import type { ReactNode } from 'react'
import { ClipboardList, Code2, Database, FileText } from 'lucide-react'
import type { AnalysisType, PreferredLanguage } from '@/lib/types'

export type WorkflowGroup = 'code' | 'query' | 'writeup' | 'cleaning'

export const ANALYSIS_OPTIONS: { value: AnalysisType; label: string }[] = [
  { value: 'unknown', label: 'Infer automatically' },
  { value: 'range_shift_exploration', label: 'Range-shift exploration' },
  { value: 'species_distribution_modelling', label: 'Species distribution modelling' },
  { value: 'distribution_mapping', label: 'Distribution mapping' },
  { value: 'temporal_trend_or_abundance', label: 'Trend / abundance assessment' },
  { value: 'invasive_monitoring_preview', label: 'Invasive monitoring preview' },
]

const SPATIAL_OPTIONS = ['Local / fine-scale', 'Country or regional', 'Continental or broad-scale']
const SKILL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced']
export const CODE_OPTIONS: PreferredLanguage[] = ['Both', 'R', 'Python']

// Workflow code is grouped into 4 tabs to reduce the previous 8-tab clutter
// and make Code/Query/Write-up/Cleaning each feel like a distinct phase of
// the research workflow. Each group exposes a sub-selector when needed.
export const WORKFLOW_GROUPS: Record<WorkflowGroup, { label: string; icon: ReactNode }> = {
  code: { label: 'Code', icon: <Code2 /> },
  query: { label: 'Query', icon: <Database /> },
  writeup: { label: 'Write-up', icon: <FileText /> },
  cleaning: { label: 'Cleaning', icon: <ClipboardList /> },
}

// Hoisted option lists with the "Infer automatically" sentinel prepended so
// SelectField consumers receive a stable array reference each render.
export const SPATIAL_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: 'infer', label: 'Infer automatically' },
  ...SPATIAL_OPTIONS.map((value) => ({ value, label: value })),
]

export const SKILL_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: 'infer', label: 'Infer automatically' },
  ...SKILL_OPTIONS.map((value) => ({ value, label: value })),
]
