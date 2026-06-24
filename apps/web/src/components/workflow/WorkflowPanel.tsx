import { useMemo } from 'react'
import { Code2, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WORKFLOW_GROUPS } from '@/constants/options'
import type { WorkflowGroup } from '@/constants/options'
import { CodeBlock } from './CodeBlock'
import { CopyButton } from './CopyButton'
import { ExportButton } from './ExportButton'
import { FilterSummary } from './FilterSummary'
import { ProseBlock } from './ProseBlock'
import { ZipButton } from './ZipButton'
import type { GbifQuery, TriageResult, WorkflowPackage } from '@/lib/types'

export function WorkflowPanel({
  workflow,
  query,
  triage,
  activeGroup,
  setActiveGroup,
  activeCodeLanguage,
  setActiveCodeLanguage,
  activeWriteupTab,
  setActiveWriteupTab,
  activeQueryTab,
  setActiveQueryTab,
}: {
  workflow: WorkflowPackage
  query: GbifQuery
  triage: TriageResult
  activeGroup: WorkflowGroup
  setActiveGroup: (group: WorkflowGroup) => void
  activeCodeLanguage: 'r' | 'python'
  setActiveCodeLanguage: (language: 'r' | 'python') => void
  activeWriteupTab: 'methods' | 'citation' | 'limitations'
  setActiveWriteupTab: (tab: 'methods' | 'citation' | 'limitations') => void
  activeQueryTab: 'sql' | 'predicate'
  setActiveQueryTab: (tab: 'sql' | 'predicate') => void
}) {
  // Each group resolves to a piece of workflow text plus the right Copy label.
  // `useMemo` keeps the prose block from recomputing its lines on unrelated
  // parent re-renders (the write-up texts are the heaviest artifacts).
  const codeContent = useMemo(
    () => (activeCodeLanguage === 'r' ? workflow.rCode : workflow.pythonCode),
    [activeCodeLanguage, workflow.rCode, workflow.pythonCode],
  )
  const codeLabel = activeCodeLanguage === 'r' ? 'R' : 'Python'

  const queryContent = activeQueryTab === 'sql' ? workflow.sqlCode : workflow.downloadRequestJson
  const queryLabel = activeQueryTab === 'sql' ? 'SQL' : 'Predicate'

  const writeupContent = useMemo(() => {
    if (activeWriteupTab === 'methods') return workflow.methodsText
    if (activeWriteupTab === 'citation') return workflow.citationInstructions
    return workflow.limitationsText
  }, [activeWriteupTab, workflow.methodsText, workflow.citationInstructions, workflow.limitationsText])
  const writeupLabel =
    activeWriteupTab === 'methods'
      ? 'Methods'
      : activeWriteupTab === 'citation'
        ? 'Citation'
        : 'Limitations'

  const copyContent =
    activeGroup === 'code'
      ? codeContent
      : activeGroup === 'query'
        ? queryContent
        : activeGroup === 'writeup'
          ? writeupContent
          : workflow.cleaningR
  const copyLabel =
    activeGroup === 'code'
      ? `Copy ${codeLabel}`
      : activeGroup === 'query'
        ? `Copy ${queryLabel}`
        : activeGroup === 'writeup'
          ? `Copy ${writeupLabel}`
          : 'Copy R cleaning'

  return (
    <section id="exports" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Code2 className="size-4 text-primary" />
          Generated workflow
        </div>
        <CopyButton content={copyContent} label={copyLabel} />
      </div>
      <FilterSummary query={query} recommendedFilters={triage.recommendedFilters} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={query.gbifSearchUrl} target="_blank" rel="noreferrer">
            GBIF.org search <ExternalLink />
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={query.apiSearchUrl} target="_blank" rel="noreferrer">
            API preview <ExternalLink />
          </a>
        </Button>
      </div>

      <Tabs value={activeGroup} onValueChange={(value) => setActiveGroup(value as WorkflowGroup)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          {Object.entries(WORKFLOW_GROUPS).map(([value, group]) => (
            <TabsTrigger key={value} value={value}>
              {group.icon}
              {group.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="code" className="min-h-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1" role="tablist" aria-label="Code language">
              {(['r', 'python'] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  role="tab"
                  aria-selected={activeCodeLanguage === language}
                  onClick={() => setActiveCodeLanguage(language)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    activeCodeLanguage === language
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {language === 'r' ? 'R' : 'Python'}
                </button>
              ))}
            </div>
            <ExportButton
              icon={<Download />}
              label={codeLabel}
              filename={activeCodeLanguage === 'r' ? 'gbif-workbench-workflow.R' : 'gbif-workbench-workflow.py'}
              content={codeContent}
            />
          </div>
          <CodeBlock content={codeContent} language={codeLabel} />
        </TabsContent>

        <TabsContent value="query" className="min-h-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1" role="tablist" aria-label="Query type">
              {(['sql', 'predicate'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeQueryTab === tab}
                  onClick={() => setActiveQueryTab(tab)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    activeQueryTab === tab
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab === 'sql' ? 'SQL' : 'Predicate'}
                </button>
              ))}
            </div>
            <ExportButton
              icon={<Download />}
              label={queryLabel}
              filename={activeQueryTab === 'sql' ? 'gbif-occurrence-cube.sql' : 'gbif-download-request.json'}
              content={queryContent}
              type={activeQueryTab === 'sql' ? undefined : 'application/json'}
            />
          </div>
          <CodeBlock content={queryContent} language={queryLabel === 'SQL' ? 'sql' : 'json'} />
        </TabsContent>

        <TabsContent value="writeup" className="min-h-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1" role="tablist" aria-label="Write-up section">
              {(['methods', 'citation', 'limitations'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeWriteupTab === tab}
                  onClick={() => setActiveWriteupTab(tab)}
                  className={`rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors ${
                    activeWriteupTab === tab
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <ExportButton
              icon={<Download />}
              label={writeupLabel}
              filename={
                activeWriteupTab === 'methods'
                  ? 'gbif-workbench-methods.md'
                  : activeWriteupTab === 'citation'
                    ? 'gbif-workbench-citation.md'
                    : 'gbif-workbench-limitations.md'
              }
              content={writeupContent}
            />
          </div>
          <ProseBlock content={writeupContent} />
        </TabsContent>

        <TabsContent value="cleaning" className="min-h-0">
          <div className="mb-2 flex items-center justify-end gap-2">
            <ExportButton
              icon={<Download />}
              label="Cleaning"
              filename="gbif-workbench-cleaning.R"
              content={workflow.cleaningR}
            />
          </div>
          <CodeBlock content={workflow.cleaningR} language="R" />
        </TabsContent>
      </Tabs>

      <ZipButton workflow={workflow} query={query} />
    </section>
  )
}