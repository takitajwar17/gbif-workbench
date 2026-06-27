import { AlertTriangle, Loader2, Menu, Play, X } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAnalyze } from './hooks/useAnalyze'
import { QuestionCard } from './components/question/QuestionCard'
import { MethodSection } from './components/header/MethodSection'
import { ResultOverview } from './components/header/ResultOverview'
import { StatusCard } from './components/header/StatusCard'
import { WorkflowProgress } from './components/header/WorkflowProgress'
import { AuthControls } from './auth/AuthProvider'
import { HistoryButton } from './components/history/HistoryButton'

const PreviewSection = lazy(() =>
  import('./components/preview/PreviewSection').then((module) => ({ default: module.PreviewSection })),
)
const TriageSection = lazy(() =>
  import('./components/triage/TriageSection').then((module) => ({ default: module.TriageSection })),
)

function App() {
  const state = useAnalyze()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr_auto] bg-background xl:h-screen xl:overflow-hidden">
      <a
        href="#workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to workspace
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1760px] items-center justify-between gap-3 px-4 lg:px-6">
          <a className="flex min-w-0 items-center gap-2 text-foreground no-underline" href="#workspace" aria-label="GBIF Workbench home">
            <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-primary">
              <img src="/favicon.svg" alt="" className="size-8" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-sm font-semibold">GBIF Workbench</strong>
              <span className="block truncate text-xs text-muted-foreground">Occurrence-data fitness-for-use</span>
            </span>
          </a>
          <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex" aria-label="Primary navigation">
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <a
                href="https://github.com/takitajwar17/gbif-workbench"
                target="_blank"
                rel="noreferrer"
                aria-label="Open GitHub repository"
                title="GitHub repository"
              >
                <GitHubMark />
              </a>
            </Button>
            <HistoryButton onRestore={state.loadHistorySnapshot} />
            <AuthControls />
            <Button
              type="button"
              onClick={state.analyzeNow}
              disabled={state.isBusy || !state.question.trim()}
              size="sm"
              title={state.question.trim() ? 'Assess this question with live GBIF occurrence data' : 'Type a research question to enable'}
            >
              {state.isBusy ? <Loader2 className="animate-spin" /> : <Play />}
              {state.isBusy ? 'Assessing…' : 'Assess study'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav"
              onClick={() => setMobileNavOpen((value) => !value)}
            >
              {mobileNavOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {mobileNavOpen && (
          <nav id="mobile-nav" className="border-t bg-background px-4 py-2 md:hidden" aria-label="Mobile navigation">
          </nav>
        )}
      </header>

      <main id="workspace" className="mx-auto flex w-full max-w-[1760px] min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 lg:px-6" aria-busy={state.isBusy}>
        <section className="mb-4 grid shrink-0 gap-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
            <div className="space-y-2">
              <h1 className="max-w-4xl text-2xl font-semibold tracking-normal text-foreground md:text-3xl">
                Check whether GBIF-mediated occurrence records fit your study.
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                Get a fitness-for-use assessment for the scoped occurrence records, matching filters, bias and limitation checks, and reproducible R / Python / SQL before committing to a download.
              </p>
            </div>
            <StatusCard status={state.status} preview={state.preview} topRisk={state.topRisk} />
          </div>
          <WorkflowProgress status={state.status} question={state.question} intent={state.intent} preview={state.preview} workflow={state.workflow} />
        </section>

        <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden xl:flex-row">
          <div
            data-pane="scope"
            aria-label="Study scope controls"
            tabIndex={0}
            className="flex min-h-0 flex-col gap-4 overflow-hidden rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 xl:h-full xl:w-[420px] xl:shrink-0"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-4" data-pane-scroll>
            <QuestionCard
              question={state.question}
              intent={state.intent}
              taxon={state.taxon}
              preferredLanguage={state.preferredLanguage}
              isBusy={state.isBusy}
              hasResults={state.hasResults}
              scopeDirty={state.scopeDirty}
              onClearResults={state.clearResults}
              onQuestionChange={state.changeQuestion}
              onDemoSelect={state.selectDemoPrompt}
              onAnalyzeNow={state.analyzeNow}
              onIntentFieldChange={state.updateIntentField}
              onCountriesChange={state.updateCountries}
              onPreferredLanguageChange={state.setPreferredLanguage}
              onRerun={state.analyzeNow}
            />

            {state.error && (
              <Alert variant="destructive">
                <AlertTriangle className="col-start-1 row-span-2 mt-0.5 size-4" />
                <AlertTitle>Analysis failed</AlertTitle>
                <AlertDescription>
                  <p>{state.error}</p>
                  <p className="mt-2 text-sm">Review the message above, then retry. Temporary AI service, GBIF, or backend issues often resolve on another run.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={state.analyzeNow}>
                    Retry analysis
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            </div>
          </div>

          <div
            data-pane="results"
            aria-label="Results and generated workflow"
            tabIndex={0}
            className="flex min-h-0 flex-col overflow-hidden rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 xl:h-full xl:min-w-0 xl:flex-1"
          >
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto pr-1 pb-4 2xl:grid-cols-[minmax(0,1.05fr)_minmax(430px,0.95fr)]" data-pane-scroll>
            <ResultOverview preview={state.preview} triage={state.triage} workflow={state.workflow} />
            <Suspense fallback={<SectionFallback label="occurrence-search preview" />}>
              <PreviewSection preview={state.preview} />
            </Suspense>
            <Suspense fallback={<SectionFallback label="fitness-for-use assessment and exports" />}>
              <TriageSection
                triage={state.triage}
                preview={state.preview}
                workflow={state.workflow}
                workflowError={state.workflowError}
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
            </Suspense>
            <MethodSection />
            </div>
          </div>
        </section>
      </main>
      <footer className="shrink-0 border-t bg-background/95 px-4 py-3 text-center text-xs leading-5 text-muted-foreground lg:px-6">
        GBIF Workbench is an independent research tool for assessing GBIF-mediated occurrence data before a DOI-backed download. It is not affiliated with GBIF.org.
      </footer>
    </div>
  )
}

function SectionFallback({ label }: { label: string }) {
  return (
    <div className="min-h-32 rounded-lg border bg-card p-4 text-sm text-muted-foreground" role="status">
      Loading {label}…
    </div>
  )
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true" focusable="false">
      <path d="M12 .3C5.4.3 0 5.7 0 12.3c0 5.3 3.4 9.8 8.2 11.4.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.8-1.6 8.2-6.1 8.2-11.4C24 5.7 18.6.3 12 .3Z" />
    </svg>
  )
}

export default App
