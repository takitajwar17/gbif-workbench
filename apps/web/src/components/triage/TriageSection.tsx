import { ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/layout/EmptyState'
import { SectionTitle } from '@/components/layout/SectionTitle'
import { WorkflowLoadingPanel } from '@/components/workflow/WorkflowLoadingPanel'
import type { WorkflowGroup } from '@/constants/options'
import { WorkflowPanel } from '@/components/workflow/WorkflowPanel'
import { RiskPanel } from './RiskPanel'
import { SupportPanel } from './SupportPanel'
import type { DataPreview, GbifQuery, TriageResult, WorkflowPackage } from '@/lib/types'

// One card combines the fast fitness-for-use assessment from
// /api/study-plan with the slower export package from /api/workflow.
export function TriageSection({
  triage,
  preview,
  workflow,
  workflowError,
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
  workflowError?: string
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
  // Empty state: no analysis yet. Keep this grid cell occupied.
  if (!triage || !preview) {
    return (
      <Card className="min-w-0">
        <CardHeader>
          <SectionTitle
            icon={<ShieldAlert />}
            title="Fitness-for-use assessment and exports"
            description="What GBIF-mediated occurrence data can support, what needs caution, and the generated R / Python / SQL workflow."
          />
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Awaiting fitness-for-use assessment"
            body="After you run the assessment, GBIF Workbench will classify the occurrence-data fit, surface risks, and generate a one-click workflow export."
          />
        </CardContent>
      </Card>
    )
  }

  // Loaded state: assessment and exports share one card, separated by
  // a thin divider while /api/workflow finishes.
  const hasExports = Boolean(workflow && query)

  return (
    <Card className="min-w-0" aria-label="Fitness-for-use assessment and exports">
      <CardHeader>
        <SectionTitle
          icon={<ShieldAlert />}
          title="Fitness-for-use assessment and exports"
          description="What GBIF-mediated occurrence data can support, what needs caution, and the generated R / Python / SQL workflow."
        />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fast assessment from /api/study-plan. */}
        <section aria-label="Fitness-for-use assessment" className="space-y-6">
          <SupportPanel triage={triage} />
          <RiskPanel risks={triage.risks} />
        </section>

        <div className="border-t border-border/60" aria-hidden="true" />

        {/* Slower exports from /api/workflow. */}
        <section aria-label="Exports" id="exports" className="space-y-4">
          <SectionTitle
            icon={<ShieldAlert />}
            title="Exports"
            description="R / Python / SQL / cleaning / writeup — built on the assessment above."
          />
          {hasExports ? (
            <WorkflowPanel
              workflow={workflow!}
              query={query!}
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
          ) : (
            <WorkflowLoadingPanel error={workflowError} />
          )}
        </section>
      </CardContent>
    </Card>
  )
}
