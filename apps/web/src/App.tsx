import { AlertTriangle, Loader2, Play } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAnalyze } from './hooks/useAnalyze'
import { InterpretationPanel } from './components/question/InterpretationPanel'
import { QuestionCard } from './components/question/QuestionCard'
import { PreviewSection } from './components/preview/PreviewSection'
import { TriageSection } from './components/triage/TriageSection'
import { MethodSection } from './components/header/MethodSection'
import { ResultOverview } from './components/header/ResultOverview'
import { StatusCard } from './components/header/StatusCard'
import { WorkflowProgress } from './components/header/WorkflowProgress'

function App() {
  const state = useAnalyze()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1760px] items-center justify-between gap-3 px-4 lg:px-6">
          <a className="flex min-w-0 items-center gap-3 text-foreground no-underline" href="#workspace" aria-label="GBIF Workbench workspace">
            <span className="min-w-0">
              <strong className="block truncate text-sm font-semibold">GBIF Workbench</strong>
              <span className="block truncate text-xs text-muted-foreground">Pre-download research triage</span>
            </span>
          </a>
          <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex" aria-label="Primary navigation">
            <Button variant="ghost" size="sm" asChild>
              <a href="#workspace">Workspace</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="#method">Method</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="#exports">Exports</a>
            </Button>
          </nav>
          <Button type="button" onClick={state.analyze} disabled={state.isBusy || !state.question.trim()} size="sm">
            {state.isBusy ? <Loader2 className="animate-spin" /> : <Play />}
            Start plan
          </Button>
        </div>
      </header>

      <main id="workspace" className="mx-auto flex w-full max-w-[1760px] flex-col px-4 py-4 lg:px-6 xl:h-[calc(100vh-4rem)] xl:overflow-hidden" aria-busy={state.isBusy}>
        <section className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] xl:shrink-0">
          <div className="space-y-2">
            <h1 className="max-w-4xl text-2xl font-semibold tracking-normal text-foreground md:text-3xl">
              Scope a GBIF study before downloading data.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              Turn a biodiversity research question into GBIF filters, live availability checks, claim triage, and reproducible workflow exports.
            </p>
          </div>
          <StatusCard status={state.status} preview={state.preview} topRisk={state.topRisk} />
          <WorkflowProgress status={state.status} question={state.question} intent={state.intent} preview={state.preview} workflow={state.workflow} />
        </section>

        <section className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[390px_minmax(0,1fr)]">
          <div
            data-pane="scope"
            aria-label="Study scope controls"
            tabIndex={0}
            className="space-y-4 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pb-4 xl:pr-2"
          >
            <QuestionCard
              question={state.question}
              draftTaxon={state.draftTaxon}
              draftRegion={state.draftRegion}
              draftYears={state.draftYears}
              draftAnalysis={state.draftAnalysis}
              draftSpatialResolution={state.draftSpatialResolution}
              draftSkillLevel={state.draftSkillLevel}
              preferredLanguage={state.preferredLanguage}
              isBusy={state.isBusy}
              onQuestionChange={state.changeQuestion}
              onDemoSelect={state.selectDemoPrompt}
              onTaxonChange={state.setDraftTaxon}
              onRegionChange={state.setDraftRegion}
              onYearsChange={state.setDraftYears}
              onAnalysisChange={state.setDraftAnalysis}
              onSpatialResolutionChange={state.setDraftSpatialResolution}
              onSkillLevelChange={state.setDraftSkillLevel}
              onPreferredLanguageChange={state.setPreferredLanguage}
              onInterpret={state.interpretScope}
              onAnalyze={state.analyze}
            />

            {state.error && (
              <Alert variant="destructive">
                <AlertTriangle className="col-start-1 row-span-2 mt-0.5 size-4" />
                <AlertTitle>Analysis failed</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <InterpretationPanel
              intent={state.intent}
              taxon={state.taxon}
              onChange={state.updateIntent}
              onCountriesChange={state.updateCountries}
              onRefresh={() => state.rerunEditedScope()}
              isBusy={state.isBusy}
            />
          </div>

          <div
            data-pane="results"
            aria-label="Results and generated workflow"
            tabIndex={0}
            className="grid min-w-0 gap-4 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pb-4 xl:pr-2 2xl:grid-cols-[minmax(0,1.05fr)_minmax(430px,0.95fr)]"
          >
            <ResultOverview preview={state.preview} triage={state.triage} workflow={state.workflow} />
            <PreviewSection preview={state.preview} />
            <TriageSection
              triage={state.triage}
              preview={state.preview}
              workflow={state.workflow}
              query={state.query}
              activeWorkflowGroup={state.activeWorkflowGroup}
              setActiveWorkflowGroup={state.setActiveWorkflowGroup}
              activeCodeLanguage={state.activeCodeLanguage}
              setActiveCodeLanguage={state.setActiveCodeLanguage}
              activeWriteupTab={state.activeWriteupTab}
              setActiveWriteupTab={state.setActiveWriteupTab}
              activeQueryTab={state.activeQueryTab}
              setActiveQueryTab={state.setActiveQueryTab}
            />
            <MethodSection />
          </div>
        </section>
      </main>
    </div>
  )
}

export default App