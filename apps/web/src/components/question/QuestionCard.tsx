import { ClipboardList, Loader2, Search, Shuffle, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SectionTitle } from '@/components/layout/SectionTitle'
import { InterpretedScopeSummary } from '@/components/question/InterpretedScopeSummary'
import { pickRandomPrompts } from '@/constants/demoPrompts'
import type { PreferredLanguage, StudyIntent, TaxonResolution } from '@/lib/types'

export function QuestionCard({
  question,
  intent,
  taxon,
  preferredLanguage,
  isBusy,
  hasResults,
  scopeDirty,
  onClearResults,
  onQuestionChange,
  onDemoSelect,
  onAnalyzeNow,
  onIntentFieldChange,
  onCountriesChange,
  onPreferredLanguageChange,
  onRerun,
}: {
  question: string
  intent: StudyIntent | null
  taxon: TaxonResolution | null
  preferredLanguage: PreferredLanguage
  isBusy: boolean
  hasResults: boolean
  scopeDirty: boolean
  onClearResults: () => void
  onQuestionChange: (value: string) => void
  onDemoSelect: (prompt: string) => void
  onAnalyzeNow: () => void
  onIntentFieldChange: <K extends keyof StudyIntent>(key: K, value: StudyIntent[K]) => void
  onCountriesChange: (value: string) => void
  onPreferredLanguageChange: (value: PreferredLanguage) => void
  onRerun: () => void
}) {
  const canAnalyze = question.trim().length > 0
  const charCount = question.length
  // charHint is a primitive (string) result of a small if-chain. Wrapping
  // it in useMemo costs more in hook bookkeeping + dep array compare than
  // the work itself saves. Compute inline instead.
  // See: rerender-simple-expression-in-memo in the Vercel React Best Practices.
  const charHint =
    !charCount
      ? 'Aim for one or two sentences with the taxon, place, time window, and analysis you want.'
      : charCount < 40
        ? 'Try adding more context — a place, time window, and analysis type help the most.'
        : charCount > 600
          ? 'Long questions are fine, but the model focuses best on the first few sentences.'
          : intent
            ? 'Edit any field in the scope below — press Re-run to apply your changes.'
            : 'Looks good. Click Analyze study to run the Workbench on this question.'

  const [prompts, setPrompts] = useState(() => pickRandomPrompts(3))
  const reshufflePrompts = useCallback(() => {
    setPrompts((current) => {
      let next = pickRandomPrompts(3)
      for (let attempt = 0; attempt < 5 && next[0]?.question === current[0]?.question; attempt++) {
        next = pickRandomPrompts(3)
      }
      return next
    })
  }, [])

  // Hide the example prompts once the user has started an analysis or has
  // results to look at. They reappear only after the user clicks Clear.
  const showPrompts = !isBusy && !hasResults

  return (
    <Card>
      <CardHeader>
        <SectionTitle
          icon={<Search />}
          title="Describe your study"
          description="Write a research question. The Workbench interprets your scope, fetches live GBIF data, and generates code and write-ups — automatically."
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="question">Research question</Label>
            {question.length > 0 && (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {charCount} characters
              </span>
            )}
          </div>
          <Textarea
            id="question"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            rows={6}
            spellCheck
            placeholder="Example: Are kingfisher populations shifting northward in Europe since 2000?"
            className="min-h-28 resize-y"
            aria-describedby="question-hint"
          />
          <p id="question-hint" className="text-xs leading-5 text-muted-foreground">
            {charHint}
          </p>
        </div>

        <Button
          type="button"
          onClick={onAnalyzeNow}
          disabled={isBusy || !canAnalyze}
          className="w-full"
          size="lg"
          title={canAnalyze ? 'Run live GBIF analysis on this question' : 'Type a research question to enable'}
        >
          {isBusy ? <Loader2 className="animate-spin" /> : <Search />}
          {isBusy ? 'Analyzing…' : 'Analyze study'}
        </Button>

        {hasResults && (
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearResults}
              className="h-7 px-2 text-xs"
              aria-label="Clear current results and show example prompts again"
            >
              <Trash2 className="size-3.5" /> Clear current results
            </Button>
          </div>
        )}

        {showPrompts && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Or start from an example</p>
            <div className="grid gap-2" aria-label="Example research prompts" aria-live="polite">
              {prompts.map((prompt) => (
                <Button
                  key={prompt.question}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start whitespace-normal p-3 text-left"
                  onClick={() => onDemoSelect(prompt.question)}
                  aria-label={`Use example: ${prompt.label} — ${prompt.question}`}
                >
                  <span className="flex w-full gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center self-start text-primary [&_svg]:size-4" aria-hidden="true">
                      <ClipboardList />
                    </span>
                    <span className="min-w-0">
                      <span className="flex h-6 items-center text-sm font-medium">{prompt.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{prompt.question}</span>
                    </span>
                  </span>
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reshufflePrompts}
              className="w-full justify-center text-xs"
              aria-label="Show 3 different example prompts"
            >
              <Shuffle className="size-3.5" aria-hidden="true" />
              Show 3 more examples
            </Button>
          </div>
        )}

        {intent && (
          <InterpretedScopeSummary
            intent={intent}
            taxon={taxon}
            preferredLanguage={preferredLanguage}
            isBusy={isBusy}
            scopeDirty={scopeDirty}
            onIntentFieldChange={onIntentFieldChange}
            onCountriesChange={onCountriesChange}
            onPreferredLanguageChange={onPreferredLanguageChange}
            onRerun={onRerun}
          />
        )}
      </CardContent>
    </Card>
  )
}