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
import { type EditorMode } from '../../types'
import { DraftSheetName, type RunSqlMode, type Sheet } from './types'
import { format } from 'sql-formatter'
import Button from './Button'
import { altOptionChar, ctrlCmdChar } from './constants'
import * as dialog from './dialog'
import { useFloating, useClientPoint, useInteractions, useDismiss, useTransitionStyles, shift } from '@floating-ui/react'

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
  onRunningSql: (sql: string, sheetName: string | null, mode: RunSqlMode) => Promise<Sheet>
  onMakingNewQuery: () => void
}

function getAutocompleteWord (s: string): string {
  if (s.includes('.') || s.includes('-') || s.includes(' ') || s.match(/^[0-9]/) !== null) {
    return `"${s}"`
  } else {
    return s
  }
}

function ContextMenu ({
  open,
  onRunDraft,
  onRunNewSql,
  onClosing,
  selectedText,
  x,
  y
}: {
  open: boolean
  onRunDraft: () => void
  onRunNewSql: () => void
  onClosing: () => void
  selectedText: string | null
  x: number | null
  y: number | null
}): JSX.Element {
  const [point, setPoint] = React.useState<{ x: number | null, y: number | null }>({ x, y })

  React.useEffect(
    () => {
      setPoint(({ x: prevX, y: prevY }) => {
        return { x: x ?? prevX, y: y ?? prevY }
      })
    },
    [x, y]
  )

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (open) => {
      if (!open) {
        onClosing()
      } else {
        // do nothing
      }
    },
    middleware: [shift()],
    placement: 'bottom-start'
  })

  const { isMounted, styles } = useTransitionStyles(context)
  const clientPoint = useClientPoint(context, { x: point.x, y: point.y })
  const dismiss = useDismiss(context)
  const { getFloatingProps } = useInteractions([clientPoint, dismiss])

  if (!isMounted || !open) { return <></> }

  return (
    <div
      ref={refs.setFloating}
      style={{
        ...floatingStyles,
        zIndex: 1000
      }}
      {...getFloatingProps()}
    >
      <div
        className="context-menu"
        style={{ ...styles }}
      >
        <div
          className="context-menu-item"
          onClick={() => {
            onClosing()
            onRunDraft()
          }}
          data-testid="editor-context-menu-run-draft"
        >
          <span className="label">{selectedText ? 'Run the selection in the draft mode' : 'Run in the draft mode'}</span>
          <span className="short-key">{ctrlCmdChar()} T</span>
        </div>
        <div
          className="context-menu-item"
          onClick={() => {
            onClosing()
            onRunNewSql()
          }}
          data-testid="editor-context-menu-run-new"
        >
          <span className="label">{selectedText ? 'Run the selection as a new query' : 'Run as a new query'}</span>
          <span className="short-key">{ctrlCmdChar()} ⇧ T</span>
        </div>
      </div>
    </div>
  )
}

interface ContextMenuOpenInfo {
  selectedText: string
  clientX: number
  clientY: number
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
  const [contextMenuOpenInfo, setContextMenuOpenInfo] = React.useState<ContextMenuOpenInfo | null>(null)

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
    (mode: RunSqlMode = 'default') => {
      if (isQueryLoading) { return }
      codeMirrorInstance.current.save()

      let value: string

      switch (mode) {
        case 'partial-new':
        case 'partial-draft': {
          const selection = codeMirrorInstance.current.getSelection() as string
          console.log(selection)

          if (selection) {
            value = selection
          } else {
            value = textareaRef.current!.value.trim()
          }
          break
        }
        case 'default':
          value = textareaRef.current!.value.trim()
          break
        default:
          throw new Error()
      }

      if (value === '') { return }

      setIsQueryLoading(true)
      onRunningSql(value, selectedSheet?.name ?? null, mode)
        .then((sheet) => {
          if (mode === 'default') {
            setShouldShowDraftNotice(false)
          }
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

    codeMirrorInstance.current.on('contextmenu', (cm, event: Event) => {
      if (!(event instanceof PointerEvent)) { return }
      setContextMenuOpenInfo({
        selectedText: cm.getSelection() as string,
        clientX: event.clientX,
        clientY: event.clientY
      })
      event.preventDefault()
    })
  }, [initialValue, mode])

  React.useEffect(() => {
    if (!codeMirrorInstance.current) { return }
    codeMirrorInstance.current.setOption('keyMap', mode)
  }, [mode])

  React.useEffect(() => {
    if (!codeMirrorInstance.current) { return }

    const relevantSheets = sheets.filter((s) => s.name !== DraftSheetName)

    const tables = {}
    const allColumns = new Set<string>()

    for (const sheet of relevantSheets) {
      for (const column of sheet.columns) {
        allColumns.add(getAutocompleteWord(column.name))
      }
    }

    for (const sheet of relevantSheets) {
      tables[getAutocompleteWord(sheet.name)] = []
    }

    if (relevantSheets.length > 0) {
      tables[getAutocompleteWord(relevantSheets[0].name)] = Array.from(allColumns)
    }

    codeMirrorInstance.current.setOption('hintOptions', {
      tables,
      defaultTable: relevantSheets[0] ? getAutocompleteWord(relevantSheets[0].name) : null,
      closeOnUnfocus: true
    })
  }, [sheets])

  React.useEffect(
    () => {
      const handler = (event): boolean => {
        if (!(event instanceof KeyboardEvent)) { return true }

        if (event.code === 'Enter' && (event.metaKey || event.ctrlKey)) {
          runSql()
          return false
        }

        if (event.code === 'Enter' && event.altKey) {
          formatSql()
          return false
        }

        if (event.code === 'KeyT' && event.shiftKey && (event.metaKey || event.ctrlKey)) {
          runSql('partial-new')
          return false
        }

        if (event.code === 'KeyT' && (event.metaKey || event.ctrlKey)) {
          runSql('partial-draft')
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

  return (
    <>
      <ContextMenu
        open={contextMenuOpenInfo !== null}
        selectedText={contextMenuOpenInfo?.selectedText ?? null}
        x={contextMenuOpenInfo?.clientX ?? null}
        y={contextMenuOpenInfo?.clientY ?? null}
        onClosing={() => { setContextMenuOpenInfo(null) }}
        onRunNewSql={() => { runSql('partial-new') }}
        onRunDraft={() => { runSql('partial-draft') }}
      />
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
          </div>
          <div className="right">
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
