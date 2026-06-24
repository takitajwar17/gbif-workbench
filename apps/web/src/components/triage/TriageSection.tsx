import { ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/layout/EmptyState'
import { SectionTitle } from '@/components/layout/SectionTitle'
import type { WorkflowGroup } from '@/constants/options'
import { WorkflowPanel } from '@/components/workflow/WorkflowPanel'
import { RiskPanel } from './RiskPanel'
import { SupportPanel } from './SupportPanel'
import type { DataPreview, GbifQuery, TriageResult, WorkflowPackage } from '@/lib/types'

export function TriageSection({
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
        <SectionTitle icon={<ShieldAlert />} title="Support verdict and exports" description="Can GBIF support this study, what to watch for, and the generated R / Python / SQL workflow." />
      </CardHeader>
      <CardContent>
        {triage && preview && workflow && query ? (
          <div className="space-y-6">
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
          <EmptyState title="Awaiting triage" body="After you run the analysis, GBIF Workbench will classify your study as supported, conditional, exploratory, or unsupported, then surface risks and a one-click workflow export." />
        )}
      </CardContent>
    </Card>
  )
}