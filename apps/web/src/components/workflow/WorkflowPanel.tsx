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
import { createAnalysisSummary } from '@/lib/exportPackage'
import type { GbifQuery, TriageResult, WorkflowPackage } from '@/lib/types'

const GROUP_DESCRIPTIONS: Record<WorkflowGroup, string> = {
  code: 'R and Python scripts for GBIF occurrence downloads and local analysis.',
  query: 'SQL cube starter and occurrence download predicate ready for the GBIF API.',
  writeup: 'Methods, citation, and limitations paragraphs for your manuscript.',
  cleaning: 'Standalone R script for coordinate and taxonomy cleanup.',
}

// Hoisted option lists for the inner SubTabs. They were constructed inline
// before, which allocated a fresh array on every WorkflowPanel render
// (the parent rerenders whenever activeGroup or any of the four tab
// sub-selectors changes). Stable references make the SubTabs render path
// cheaper and let the parent diff them with reference equality.
// See: rendering-hoist-jsx in the Vercel React Best Practices.
const LANGUAGE_OPTIONS = [
  { value: 'r' as const, label: 'R' },
  { value: 'python' as const, label: 'Python' },
]
const QUERY_FORMAT_OPTIONS = [
  { value: 'sql' as const, label: 'SQL' },
  { value: 'predicate' as const, label: 'Predicate' },
]
const WRITEUP_SECTION_OPTIONS = [
  { value: 'methods' as const, label: 'Methods' },
  { value: 'citation' as const, label: 'Citation' },
  { value: 'limitations' as const, label: 'Limitations' },
]

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
  // The strings themselves live on `workflow` and are reference-stable across
  // re-renders; the ternaries below just pick which field to read. Wrapping
  // these in useMemo would cost more (hook bookkeeping + dep compare) than
  // the single ternary they replace. The strings are not children of any
  // memoized component, so there's no stability benefit either.
  // See: rerender-simple-expression-in-memo in the Vercel React Best Practices.
  const codeContent = activeCodeLanguage === 'r' ? workflow.rCode : workflow.pythonCode
  const codeLabel = activeCodeLanguage === 'r' ? 'R' : 'Python'

  const queryContent = activeQueryTab === 'sql' ? workflow.sqlCode : workflow.downloadRequestJson
  const queryLabel = activeQueryTab === 'sql' ? 'SQL' : 'Predicate'

  const writeupContent =
    activeWriteupTab === 'methods'
      ? workflow.methodsText
      : activeWriteupTab === 'citation'
        ? workflow.citationInstructions
        : workflow.limitationsText
  const writeupLabel =
    activeWriteupTab === 'methods' ? 'Methods' : activeWriteupTab === 'citation' ? 'Citation' : 'Limitations'

  const copyContent =
    activeGroup === 'code' ? codeContent : activeGroup === 'query' ? queryContent : activeGroup === 'writeup' ? writeupContent : workflow.cleaningR
  const copyLabel =
    activeGroup === 'code'
      ? `Copy ${codeLabel}`
      : activeGroup === 'query'
        ? `Copy ${queryLabel}`
        : activeGroup === 'writeup'
          ? `Copy ${writeupLabel}`
          : 'Copy R cleaning'
  const analysisSummary = useMemo(() => createAnalysisSummary(workflow), [workflow])

  return (
    <section id="exports" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Code2 className="size-4 text-primary" aria-hidden="true" />
            Generated occurrence workflow
          </div>
          <p className="mt-1 text-xs text-muted-foreground">R and Python occurrence-download code, GBIF query artifacts, methods text, and a one-click export zip.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton content={copyContent} label={copyLabel} />
          <Button variant="outline" size="sm" asChild>
            <a href={query.gbifSearchUrl} target="_blank" rel="noreferrer">
              GBIF.org <ExternalLink />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={query.apiSearchUrl} target="_blank" rel="noreferrer">
              Occurrence-search URL <ExternalLink />
            </a>
          </Button>
        </div>
      </div>

      <FilterSummary query={query} recommendedFilters={triage.recommendedFilters} />

      <Tabs value={activeGroup} onValueChange={(value) => setActiveGroup(value as WorkflowGroup)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          {Object.entries(WORKFLOW_GROUPS).map(([value, group]) => (
            <TabsTrigger key={value} value={value}>
              {group.icon}
              {group.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <p className="text-xs leading-5 text-muted-foreground">{GROUP_DESCRIPTIONS[activeGroup]}</p>

        <TabsContent value="code" className="min-h-0">
          <SubTabs
            label="Language"
            value={activeCodeLanguage}
            onChange={setActiveCodeLanguage}
            options={LANGUAGE_OPTIONS}
          />
          <CodeToolbar
            exportIcon={<Download />}
            exportLabel={codeLabel}
            exportFilename={activeCodeLanguage === 'r' ? 'gbif-workbench-workflow.R' : 'gbif-workbench-workflow.py'}
            exportContent={codeContent}
          />
          <CodeBlock content={codeContent} language={codeLabel} />
        </TabsContent>

        <TabsContent value="query" className="min-h-0">
          <SubTabs
            label="Format"
            value={activeQueryTab}
            onChange={setActiveQueryTab}
            options={QUERY_FORMAT_OPTIONS}
          />
          <CodeToolbar
            exportIcon={<Download />}
            exportLabel={queryLabel}
            exportFilename={activeQueryTab === 'sql' ? 'gbif-occurrence-cube.sql' : 'gbif-download-request.json'}
            exportContent={queryContent}
            exportType={activeQueryTab === 'sql' ? undefined : 'application/json'}
          />
          <CodeBlock content={queryContent} language={queryLabel === 'SQL' ? 'sql' : 'json'} />
        </TabsContent>

        <TabsContent value="writeup" className="min-h-0">
          <SubTabs
            label="Section"
            value={activeWriteupTab}
            onChange={setActiveWriteupTab}
            options={WRITEUP_SECTION_OPTIONS}
          />
          <CodeToolbar
            exportIcon={<Download />}
            exportLabel={writeupLabel}
            exportFilename={
              activeWriteupTab === 'methods'
                ? 'gbif-workbench-methods.md'
                : activeWriteupTab === 'citation'
                  ? 'gbif-workbench-citation.md'
                  : 'gbif-workbench-limitations.md'
            }
            exportContent={writeupContent}
          />
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

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <ExportButton
          icon={<Download />}
          label="Analysis summary"
          filename="gbif-workbench-analysis.md"
          content={analysisSummary}
        />
        <ExportButton
          icon={<Download />}
          label="Complete JSON"
          filename="gbif-workbench-analysis.json"
          content={workflow.jsonPlan}
          type="application/json"
        />
        <ZipButton workflow={workflow} query={query} />
      </div>
    </section>
  )
}

function SubTabs<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (next: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="mb-2 inline-flex items-center gap-1 rounded-md border bg-muted/40 p-1 text-xs" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-sm px-2.5 py-1 font-medium transition-colors ${
            value === option.value ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function CodeToolbar({
  exportIcon,
  exportLabel,
  exportFilename,
  exportContent,
  exportType,
}: {
  exportIcon: React.ReactNode
  exportLabel: string
  exportFilename: string
  exportContent: string
  exportType?: string
}) {
  return (
    <div className="mb-2 flex items-center justify-end gap-2">
      <ExportButton icon={exportIcon} label={exportLabel} filename={exportFilename} content={exportContent} type={exportType} />
    </div>
  )
}
