import React from 'react'
import { useWorkspaceContext } from './WorkspaceContext'
import { type AiResult, askAi, getAiDataNoticeShownAt, setAiDataNoticeShownAt } from '../api'
import * as dialog from './dialog'
import './AskAi.scss'

export interface EditorContext {
  selection: string | null
  currentSql: string | null
}

const PLACEHOLDERS = [
  'Ask AI to write SQL. Press enter to submit.',
  'Highlight a part of your SQL and ask AI to rewrite it e.g. formatting date. Press enter to submit.',
  'Example: What is revenue per year? Order by largest revenue.',
  'Example: [Highlight the column in the editor] Format it to YYYY-MM-DD.',
  'Example: Format all dates to YYYY-MM-DD',
  'Example: Format all dates to something like May 3, 2024',
  'Example: Order by smallest revenue',
  'Example: What are the possible values of the column country?',
  'Example: Which country has the highest revenue?',
  'Example: [Highlight the column in the editor] Format it to 2 decimal points.'
]

export default React.forwardRef(function AskAi (
  {
    show,
    onGetContext,
    onSuccess
  }: {
    show: boolean
    onGetContext: () => EditorContext
    onSuccess: (result: AiResult, isAutorun: boolean) => Promise<void>
  },
  ref: React.Ref<unknown>
): JSX.Element {
  const workspaceState = useWorkspaceContext()

  const askAiTextboxRef = React.useRef<HTMLInputElement>(null)
  const [command, setCommand] = React.useState<string>('')
  const [isAutorun, setIsAutorun] = React.useState<boolean>(true)
  const [placeholderIndex, setPlaceholderIndex] = React.useState<number>(PLACEHOLDERS.length - 1)
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  const focus = React.useCallback(
    () => {
      askAiTextboxRef.current?.focus()
      askAiTextboxRef.current?.select()
    },
    []
  )

  const maybeShowAiDataNotice = React.useCallback(
    () => {
      const shownAt = getAiDataNoticeShownAt()

      if (!shownAt || (new Date().getTime() - shownAt) >= (3 * 30 * 24 * 60 * 60 * 1000)) { // 3 months
        dialog.showDialog(
          'AI Data Privacy Disclosure',
          '<div class="ai-data-notice-body">' +
            '<div>The below information will strictly used for the AI feature and not be shared nor used anywhere else:</div>' +
            '<div class="checklist">' +
              '<div class="green"><i class="fas fa-check-circle"></i> SQL statements</div>' +
              '<div class="green"><i class="fas fa-check-circle"></i> Table names</div>' +
              '<div class="green"><i class="fas fa-check-circle"></i> Column names</div>' +
            '</div>' +
            '<div>The below information is <span class="highlighted">not</span> used and <span class="highlighted">does not</span> leave your machine:</div>' +
            '<div class="checklist">' +
              '<div class="red"><i class="fas fa-exclamation-circle"></i> Data and values in the tables</div>' +
            '</div>' +
          '</div>',
          true,
          'I understand'
        )
        setAiDataNoticeShownAt()
      }
    },
    []
  )

  React.useEffect(
    () => {
      if (show) {
        setPlaceholderIndex((previousIndex) => ((previousIndex + 1) % PLACEHOLDERS.length))
        maybeShowAiDataNotice()
      }
    },
    [show, maybeShowAiDataNotice]
  )

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => { focus() }
    }),
    [focus]
  )

  const submit = React.useCallback(
    async () => {
      if (isLoading) { return }

      const sanitizedCommand = command.trim()
      if (sanitizedCommand === '') { return }

      setIsLoading(true)
      try {
        const context = onGetContext()

        let currentSql = context.currentSql?.trim() ?? null
        if (!currentSql) { currentSql = null }

        let selection = context.selection?.trim() ?? null
        if (!selection) { selection = null }

        const result = await askAi(
          sanitizedCommand,
          selection,
          currentSql,
          workspaceState.results.filter((r) => r.base.isComposable()).map((r) => r.base)
        )
        await onSuccess(result, isAutorun)
      } catch (e) {
        const error = e as any

        void dialog.showError('Asking AI failed', error.message as string, { action: 'ask_ai_failed' })
      } finally {
        setIsLoading(false)
        setTimeout(() => { focus() }, 1)
      }
    },
    [command, focus, isAutorun, isLoading, onGetContext, onSuccess, workspaceState.results]
  )

  return (
    <div
      className="ask-ai"
      data-testid="ask-ai-panel"
      style={{
        display: show ? 'flex' : 'none'
      }}
    >
      <span>
        {isLoading
          ? (
          <span className="spinner" style={{ marginRight: '0px', color: '#999' }} />
            )
          : (
          <i className="fas fa-magic"></i>
            )}
      </span>
      <input
        type="text"
        placeholder={PLACEHOLDERS[placeholderIndex]}
        ref={askAiTextboxRef}
        value={command}
        onChange={(event) => { setCommand(event.target.value) }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !(event.metaKey || event.ctrlKey || event.altKey)) {
            void submit()
            event.stopPropagation()
            event.preventDefault()
          }
        }}
        disabled={isLoading}
      />
      <span
        className="submit-button"
        onClick={() => {
          void submit()
        }}
      >Enter ⏎</span>
      <span
        className="auto-run-panel"
      >
        <input id="isAutorun" type="checkbox" checked={isAutorun} onChange={(event) => { setIsAutorun(event.target.checked) }}/>
        <label htmlFor="isAutorun">Auto-run?</label>
      </span>
      <span
        className="help-button"
        onClick={() => {
          window.shellApi.openExternal('https://superintendent.app/ai/help')
        }}
      ><i className="fas fa-question-circle"></i></span>
    </div>
  )
})
