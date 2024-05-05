import CodeMirror from 'codemirror'
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
import { getInitialEditorMode } from '../api'
import { EditorModeChannel, type EditorMode } from '../../types'
import { type Result, Sheet } from './types'
import { type ObjectWrapper } from './WorkspaceContext'
import './CodeEditor.scss'
import { format } from 'sql-formatter'
import * as dialog from './dialog'

export interface ContextMenuOpenInfo {
  selectedText: string
  clientX: number
  clientY: number
}

function getAutocompleteWord (s: string): string {
  if (s.includes('.') || s.includes('-') || s.includes(' ') || s.match(/^[0-9]/) !== null) {
    return `"${s}"`
  } else {
    return s
  }
}

export interface CodeEditorRef {
  getCursor: () => any | null
  listSelections: () => any | null
  getValue: () => string
  focus: () => void
  setOption: (option: string, value: any) => void
  save: () => void
  setValue: (value: string) => void
  setCursor: (cursor: any) => void
  setSelections: (selections: any) => void
  lastLine: () => number
  getLine: (line: number) => string
  replaceSelection: (value: string, replaceOption: string) => void
  getSelection: () => string
  refresh: () => void
  format: (newContent: string | null) => void
}

export default React.forwardRef(function CodeEditor ({
  placeholder,
  results,
  onContextMenu,
  onBlur
}: {
  placeholder: string
  results: Array<ObjectWrapper<Result>>
  onContextMenu?: (info: ContextMenuOpenInfo) => void
  onBlur?: () => void
}, ref: React.ForwardedRef<CodeEditorRef>): JSX.Element {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const codeMirrorInstance = React.useRef<any>(null)
  const [editorMode, setEditorMode] = React.useState<EditorMode>(getInitialEditorMode())

  const formatSql = React.useCallback(
    (newContent: string | null) => {
      let sql = newContent ?? codeMirrorInstance.current.getValue()

      try {
        sql = format(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          newContent ?? codeMirrorInstance.current.getValue(),
          {
            language: 'sql',
            linesBetweenQueries: 2
          }
        )
      } catch (e) {
        const error = e as any
        void dialog.showError('Formatting SQL failed', error.message as string, { action: 'formatting_sql_failed', extras: { sql } })
      }

      codeMirrorInstance.current.setValue(sql)
      const lastLine = codeMirrorInstance.current.lastLine()
      const lastCharIndex = codeMirrorInstance.current.getLine(lastLine).length
      codeMirrorInstance.current.setCursor({ line: lastLine, ch: lastCharIndex })
    },
    []
  )

  React.useImperativeHandle(
    ref,
    () => ({
      getCursor: () => codeMirrorInstance.current.getCursor(),
      listSelections: () => codeMirrorInstance.current.listSelections(),
      getValue: () => codeMirrorInstance.current.getValue(),
      focus: () => codeMirrorInstance.current.focus(),
      setOption: (option: string, value: any) => codeMirrorInstance.current.setOption(option, value),
      save: () => codeMirrorInstance.current.save(),
      setValue: (value: string) => codeMirrorInstance.current.setValue(value),
      setCursor: (cursor: any) => codeMirrorInstance.current.setCursor(cursor),
      setSelections: (selections: any) => codeMirrorInstance.current.setSelections(selections),
      lastLine: () => codeMirrorInstance.current.lastLine(),
      getLine: (line: number) => codeMirrorInstance.current.getLine(line),
      replaceSelection: (value: string, replaceOption: string) => codeMirrorInstance.current.replaceSelection(value, replaceOption),
      getSelection: () => codeMirrorInstance.current.getSelection(),
      refresh: () => codeMirrorInstance.current.refresh(),
      format: (newContent: string | null = null) => { formatSql(newContent) }
    }),
    [formatSql]
  )

  React.useEffect(
    () => {
      const callback = (event, mode: any): void => { setEditorMode(mode as EditorMode) }
      const removeListener = window.ipcRenderer.on(EditorModeChannel, callback)

      return () => {
        removeListener()
      }
    },
    [setEditorMode]
  )

  React.useEffect(
    () => {
      if (codeMirrorInstance.current) { return }

      codeMirrorInstance.current = CodeMirror.fromTextArea(
        textareaRef.current!,
        {
          value: '',
          mode: 'text/x-sql',
          indentWithTabs: false,
          smartIndent: true,
          lineNumbers: true,
          matchBrackets: true,
          dragDrop: false,
          keyMap: editorMode,
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

        if (onContextMenu) {
          onContextMenu({
            selectedText: cm.getSelection() as string,
            clientX: event.clientX,
            clientY: event.clientY
          })
        }

        event.preventDefault()
      })

      codeMirrorInstance.current.on('blur', () => {
        if (onBlur) {
          onBlur()
        }
      })
    },
    [editorMode, onBlur, onContextMenu]
  )

  React.useEffect(
    () => {
      if (!codeMirrorInstance.current) { return }
      codeMirrorInstance.current.setOption('keyMap', editorMode)
    },
    [editorMode]
  )

  React.useEffect(
    () => {
      if (!codeMirrorInstance.current) { return }

      const relevantResults = results.filter((s) => s.base instanceof Sheet)

      const tables = {}
      const allColumns = new Set<string>()

      for (const sheet of relevantResults) {
        for (const column of (sheet.base as Sheet).columns) {
          allColumns.add(getAutocompleteWord(column.name))
        }
      }

      for (const sheet of relevantResults) {
        tables[getAutocompleteWord((sheet.base as Sheet).name)] = []
      }

      if (relevantResults.length > 0) {
        tables[getAutocompleteWord((relevantResults[0].base as Sheet).name)] = Array.from(allColumns)
      }

      codeMirrorInstance.current.setOption('hintOptions', {
        tables,
        defaultTable: relevantResults[0] ? getAutocompleteWord((relevantResults[0].base as Sheet).name) : null,
        closeOnUnfocus: true
      })
    },
    [results]
  )

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: '#ccc'
      }}
    >
      <textarea ref={textareaRef} placeholder={placeholder}/>
    </div>
  )
})
