import React from 'react'
import 'codemirror/lib/codemirror.css'
import 'codemirror/addon/display/placeholder'
import 'codemirror/addon/edit/matchbrackets'
import 'codemirror/addon/hint/show-hint'
import 'codemirror/addon/hint/show-hint.css'
import 'codemirror/addon/hint/sql-hint'
import 'codemirror/addon/hint/anyword-hint'
import 'codemirror/addon/comment/comment'
import 'codemirror/keymap/vim.js'
import './Editor.scss'
import Button from './Button'
import { altOptionChar, ctrlCmdChar } from './constants'
import { update } from '../api'
import { StateChangeApi, useDispatch, useWorkspaceContext } from './WorkspaceContext'
import * as dialog from './dialog'
import CodeEditor, { type CodeEditorRef } from './CodeEditor'

function extractUpdatingResult (sql: string): string | null {
  const quoteMatches = sql.match(/update\s+"([^"]+)"/i)

  if (quoteMatches && quoteMatches.length > 1) {
    return quoteMatches[1]
  }

  const matches = sql.match(/update\s+([^\s]+)/i)

  if (matches && matches.length > 1) {
    return matches[1]
  }

  return null
}

export default function Editor ({
  onGoToQueryMode,
  show
}: {
  onGoToQueryMode: () => void
  show: boolean
}): JSX.Element {
  const codeMirrorInstance = React.useRef<CodeEditorRef>(null)
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  const workspaceState = useWorkspaceContext()
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  React.useEffect(
    () => {
      codeMirrorInstance.current!.refresh()
    },
    [show]
  )

  const runSql = React.useCallback(
    async () => {
      if (isLoading) { return }
      codeMirrorInstance.current!.save()

      const sql = codeMirrorInstance.current!.getValue().trim()

      if (sql === '') { return }

      const replaceTableName = extractUpdatingResult(sql)
      const replace = workspaceState.results.find((r) => r.base.name === replaceTableName)

      if (!replace) {
        void dialog.showError('Running the update SQL failed', 'Unable to detect which sheet should be updated.', { action: 'updating_failed', extras: { sql } })
        return
      }

      try {
        setIsLoading(true)
        const sheet = await update(sql, replace.base)

        stateChangeApi.addOrReplaceResult(sheet)
        stateChangeApi.setSelectedResultId(sheet.id)

        dialog.showSuccess('Updating succeeded', `The update on ${sheet.name} has been executed successfully.`)
      } catch (err) {
        const message = err as any as string
        let postBody: string | null = null

        try {
          if (message.includes('Could not parse string') && message.includes('format specifier')) {
            postBody = 'It looks like you are having an issue with date parsing. Please review <span class="link" onclick="window.shellApi.openExternal(\'https://duckdb.org/docs/sql/functions/dateformat.html\')">the strptime documentation</span> for accurate date parsing instruction.\n\nIf you need help, contact support@superintendent.app.'
          }
        } catch (e) {}

        void dialog.showError('Running the update SQL failed', err as any as string, { action: 'updating_failed', extras: { sql } }, postBody)
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, stateChangeApi, workspaceState.results]
  )

  const formatSql = React.useCallback(
    (newContent: string | null = null) => {
      codeMirrorInstance.current!.format(newContent)
    },
    []
  )

  React.useEffect(
    () => {
      if (show) {
        setTimeout(() => { codeMirrorInstance.current!.focus() }, 10)
      }
    },
    [show]
  )

  React.useEffect(
    () => {
      const handler = (event): boolean => {
        if (!show) { return true }
        if (!(event instanceof KeyboardEvent)) { return true }

        if (event.code === 'KeyU' && (event.metaKey || event.ctrlKey)) {
          onGoToQueryMode()
          return false
        }

        if (event.code === 'Enter' && (event.metaKey || event.ctrlKey)) {
          void runSql()
          return false
        }

        if (event.code === 'Enter' && event.altKey) {
          formatSql()
          return false
        }

        return true
      }
      document.addEventListener('keydown', handler)

      return () => {
        document.removeEventListener('keydown', handler)
      }
    },
    [show, onGoToQueryMode, runSql, formatSql]
  )

  return (
    <>
      <div className="toolbarSection top" style={{ borderLeft: '1px solid #666' }}>
        <div className="inner">
          <div className="left">
            <Button
              onClick={() => { void runSql() }}
              icon={<i className="fas fa-play"/>}
              isLoading={isLoading}
              testId="update-sql"
            >
              Run Update
              <span className="short-key">{ctrlCmdChar()} ⏎</span>
            </Button>
            <span className="separator" />
            <Button
              onClick={() => { formatSql() }}
              icon={<i className="fas fa-align-justify" />}
              testId="format-sql"
            >
              Format
              <span className="short-key">
                {altOptionChar()} ⏎
              </span>
            </Button>
          </div>
          <div className="right">
            <Button
              onClick={() => { onGoToQueryMode() }}
              icon={<i className="fas fa-search"></i>}
              testId="query-mode-button"
            >
              Query mode
              <span className="short-key">{ctrlCmdChar()} U</span>
            </Button>
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          flexGrow: 1000
        }}
        data-testid="update-editor"
      >
        <CodeEditor
          ref={codeMirrorInstance}
          placeholder="Write an update SQL..."
          results={workspaceState.results}
        />
      </div>
    </>
  )
}
