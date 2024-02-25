import CodeMirror from 'codemirror'
import React, { Fragment } from 'react'
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
import { DatabaseEngineChannel, type DatabaseEngine, type EditorMode } from '../../types'
import { type Sheet } from './types'
import { format } from 'sql-formatter'
import Button from './Button'
import { altOptionChar, ctrlCmdChar } from './constants'
import * as dialog from './dialog'
import { getInitialDatabaseEngine } from '../api'

export interface Ref {
  getValue: () => string
  setValue: (newValue: string) => void
  addText: (text: string) => void
  focus: () => void
}

interface Props {
  initialValue?: string | null
  mode: EditorMode
  sheets: Sheet[]
  selectedSheet: Sheet | null
  onRunningSql: (sql: string, sheetName: string | null) => Promise<Sheet>
  onMakingNewQuery: () => void
}

function getAutocompleteWord (s: string): string {
  if (s.includes('.') || s.includes('-') || s.includes(' ') || s.match(/^[0-9]/) !== null) {
    return `"${s}"`
  } else {
    return s
  }
}

export default React.forwardRef<Ref, Props>(function Editor ({
  initialValue,
  mode,
  sheets,
  selectedSheet,
  onRunningSql,
  onMakingNewQuery
}: Props, ref): JSX.Element {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const codeMirrorInstance = React.useRef<any>(null)
  const [isQueryLoading, setIsQueryLoading] = React.useState<boolean>(false)
  const [shownSheet, setShownSheet] = React.useState<Sheet | null>(null)
  const [shouldShowDraftNotice, setShouldShowDraftNotice] = React.useState<boolean>(false)
  const [shouldShowCsvNotice, setShouldShowCsvNotice] = React.useState<boolean>(false)

  React.useEffect(
    () => {
      if (selectedSheet === null) {
        codeMirrorInstance.current?.setOption('readOnly', false)
        setShouldShowDraftNotice(false)
        setShouldShowCsvNotice(false)
        setShownSheet(null)
        return
      }

      if (!selectedSheet || shownSheet === selectedSheet) { return }

      codeMirrorInstance.current.save()

      const cursor = codeMirrorInstance.current.getCursor()
      const selections = codeMirrorInstance.current.listSelections()

      if (shownSheet) {
        shownSheet.editorState = {
          cursor,
          selections,
          draft: textareaRef.current!.value.trim()
        }
      }

      if (selectedSheet?.editorState?.draft && selectedSheet?.editorState?.draft.trim() !== selectedSheet.sql.trim()) {
        codeMirrorInstance.current.setValue(selectedSheet?.editorState?.draft)
        setShouldShowDraftNotice(true)
      } else {
        codeMirrorInstance.current.setValue(selectedSheet.sql)
        setShouldShowDraftNotice(false)
      }

      if (selectedSheet.editorState?.cursor && selectedSheet.editorState?.selections) {
        codeMirrorInstance.current.setCursor(selectedSheet.editorState.cursor)
        codeMirrorInstance.current.setSelections(selectedSheet.editorState.selections)
      } else {
        codeMirrorInstance.current.setCursor(cursor)
        codeMirrorInstance.current.setSelections(selections)
      }

      codeMirrorInstance.current.focus()
      setShownSheet(selectedSheet)

      codeMirrorInstance.current.setOption('readOnly', selectedSheet.isCsv ? 'nocursor' : false)
      setShouldShowCsvNotice(selectedSheet.isCsv)
    },
    [selectedSheet, shownSheet]
  )

  React.useImperativeHandle(ref, () => ({
    getValue: () => {
      codeMirrorInstance.current.save()
      return textareaRef.current!.value
    },
    setValue: (newValue: string) => {
      codeMirrorInstance.current.setValue(newValue)
    },
    addText: (text: string) => {
      codeMirrorInstance.current.replaceSelection(text)
    },
    focus: () => {
      codeMirrorInstance.current.focus()
    }
  }))

  const formatSql = React.useCallback(
    () => {
      codeMirrorInstance.current.setValue(
        format(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          codeMirrorInstance.current.getValue(),
          {
            language: 'sql',
            indent: '  ',
            uppercase: false,
            linesBetweenQueries: 2
          }
        )
      )
    },
    [codeMirrorInstance]
  )

  const revertSql = React.useCallback(
    () => {
      if (!shownSheet) { return }
      codeMirrorInstance.current.setValue(shownSheet.sql)
      shownSheet.editorState = {}
      setShouldShowDraftNotice(false)
      codeMirrorInstance.current.focus()
    },
    [shownSheet]
  )

  const runSql = React.useCallback(
    () => {
      if (isQueryLoading) { return }
      codeMirrorInstance.current.save()
      const value = textareaRef.current!.value

      setIsQueryLoading(true)
      onRunningSql(
        value,
        selectedSheet?.name ?? null
      )
        .then((sheet) => {
          setShouldShowDraftNotice(false)
        })
        .catch((err) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          dialog.showError('Found an error!', err.message)
        })
        .finally(() => {
          setIsQueryLoading(false)
        })
    },
    [isQueryLoading, onRunningSql, selectedSheet]
  )

  React.useEffect(() => {
    codeMirrorInstance.current = CodeMirror.fromTextArea(
      textareaRef.current!,
      {
        value: initialValue ?? '',
        mode: 'text/x-sql',
        indentWithTabs: false,
        smartIndent: true,
        lineNumbers: true,
        matchBrackets: true,
        dragDrop: false,
        keyMap: mode,
        tabSize: 2,
        autofocus: true,
        extraKeys: {
          'Ctrl-Space': 'autocomplete',
          'Cmd-Space': 'autocomplete',
          'Ctrl-/': 'toggleComment',
          'Cmd-/': 'toggleComment'
        }
      }
    )

    let firstCharRecorded = false

    codeMirrorInstance.current.on('keyup', (cm, event) => {
      if (cm.state.completionActive) {
        firstCharRecorded = false
        return
      }
      if (cm.state.vim && !cm.state.vim.insertMode) {
        firstCharRecorded = false
        return
      }

      if (
        (event.keyCode >= 97 && event.keyCode <= 122) || // a-z
        (event.keyCode >= 65 && event.keyCode <= 90) || // A-Z
        (event.keyCode >= 48 && event.keyCode <= 57) || // 0-9
        event.keyCode === 95 // _
      ) {
        if (firstCharRecorded) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          CodeMirror.commands.autocomplete(cm, undefined, { completeSingle: false })
        } else {
          firstCharRecorded = true
        }
      } else {
        firstCharRecorded = false
      }
    })
  }, [initialValue, mode])

  React.useEffect(() => {
    if (!codeMirrorInstance.current) { return }
    codeMirrorInstance.current.setOption('keyMap', mode)
  }, [mode])

  React.useEffect(() => {
    if (!codeMirrorInstance.current) { return }

    const tables = {}
    const allColumns = new Set<string>()

    for (const sheet of sheets) {
      for (const column of sheet.columns) {
        allColumns.add(getAutocompleteWord(column.name))
      }
    }

    for (const sheet of sheets) {
      tables[getAutocompleteWord(sheet.name)] = []
    }

    if (sheets.length > 0) {
      tables[getAutocompleteWord(sheets[0].name)] = Array.from(allColumns)
    }

    codeMirrorInstance.current.setOption('hintOptions', {
      tables,
      defaultTable: sheets[0] ? getAutocompleteWord(sheets[0].name) : null,
      closeOnUnfocus: true
    })
  }, [sheets])

  React.useEffect(
    () => {
      const handler = (event): boolean => {
        if (event.code === 'Enter' && (event.metaKey || event.ctrlKey)) {
          runSql()
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
    [runSql, formatSql]
  )

  const buttons: JSX.Element[] = []

  if (!selectedSheet?.isCsv) {
    buttons.push(
      <Button
        onClick={() => { runSql() }}
        isLoading={isQueryLoading}
        icon={<i className="fas fa-play"/>}
        testId="run-sql"
      >
        Run SQL
        <span className="short-key">{ctrlCmdChar()} ⏎</span>
      </Button>
    )
  }

  if (selectedSheet !== null || shownSheet?.isCsv) {
    buttons.push(
      <Button
        onClick={() => { onMakingNewQuery() }}
        icon={<i className="fas fa-plus-square"/>}
        testId="new-sql"
      >
        New SQL
        <span className="short-key">{ctrlCmdChar()} N</span>
      </Button>
    )
  }

  const [databaseEngine, setDatabaseEngine] = React.useState<DatabaseEngine>(getInitialDatabaseEngine())
  React.useEffect(() => {
    const callback = (event, engine: any): void => { setDatabaseEngine(engine as DatabaseEngine) }
    const removeListener = window.ipcRenderer.on(DatabaseEngineChannel, callback)

    return () => {
      removeListener()
    }
  })

  return (
    <>
      <div className="toolbarSection top" style={{ borderLeft: '1px solid #666' }}>
        <div className="inner">
          <div className="left">
            {buttons.map((button, index) => {
              return (
                <Fragment key={index}>
                  {index > 0 && <span className="separator" />}
                  {button}
                </Fragment>
              )
            })}
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
            <span className="separator" />
            <Button
              onClick={() => {
                window.shellApi.openExternal('https://docs.superintendent.app')
              }}
              icon={<i className="fas fa-question-circle"/>}
            >
              Docs
            </Button>
          </div>
          <div className="right">
            <span className="databaseEngine">
              {databaseEngine === 'duckdb' ? 'DuckDB' : 'SQLite'}
            </span>
          </div>
        </div>
      </div>
      {shouldShowDraftNotice && (
        <div className="draft-notice" data-testid="draft-notice">
          This is a draft. Click <span className="link" onClick={() => { revertSql() }}>here</span> to revert to the original SQL.
        </div>
      )}
      {shouldShowCsvNotice && (
        <div className="draft-notice">
          This is an imported CSV. You cannot modify its SQL.
        </div>
      )}
      <div
        style={{
          position: 'relative',
          flexGrow: 1000
        }}
      >
        {shouldShowCsvNotice && (
          <div
            style={{
              backgroundColor: '#333',
              opacity: 0.5,
              position: 'absolute',
              width: '100%',
              height: '100%',
              zIndex: 1000
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backgroundColor: '#ccc'
          }}
        >
          <textarea ref={textareaRef} placeholder="Compose a beautiful SQL..." />
        </div>
      </div>
    </>
  )
})
