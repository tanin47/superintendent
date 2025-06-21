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
import { type RunSqlMode, type Result, DraftSheetName, DraftSql, DraftResult, generateWorkspaceItemId, type ComposableItem } from './types'
import Button from './Button'
import { altOptionChar, ctrlCmdChar } from './constants'
import * as dialog from './dialog'
import { useFloating, useClientPoint, useInteractions, useDismiss, useTransitionStyles, shift } from '@floating-ui/react'
import { hasValidLicense, maybeShowPurchaseNotice, query } from '../api'
import { StateChangeApi, type ObjectWrapper, useDispatch, useWorkspaceContext } from './WorkspaceContext'
import { type RenameDialogInfo } from './RenameDialog'
import CodeEditor, { type CodeEditorRef } from './CodeEditor'

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

export interface EditorRef {
  commitCurrentState: () => void
}

export default React.forwardRef(function Editor ({
  show,
  editingItem,
  onRenamingSheet,
  onGoToUpdateMode
}: {
  show: boolean
  editingItem: ObjectWrapper<ComposableItem> | null
  onRenamingSheet: (info: RenameDialogInfo) => void
  onGoToUpdateMode: () => void
}, ref: React.ForwardedRef<EditorRef>): JSX.Element {
  const codeMirrorInstance = React.useRef<CodeEditorRef>(null)
  const [isQueryLoading, setIsQueryLoading] = React.useState<boolean>(false)
  const [shownComposableItemId, setShownComposableItemId] = React.useState<string | null>(null)
  const [shouldShowDraftNotice, setShouldShowDraftNotice] = React.useState<boolean>(false)
  const [shouldShowCsvNotice, setShouldShowCsvNotice] = React.useState<boolean>(false)
  const [contextMenuOpenInfo, setContextMenuOpenInfo] = React.useState<ContextMenuOpenInfo | null>(null)

  const workspaceState = useWorkspaceContext()
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const saveEditorState = React.useCallback(
    () => {
      if (!shownComposableItemId) { return }

      const cursor = codeMirrorInstance.current!.getCursor()
      const selections = codeMirrorInstance.current!.listSelections()

      stateChangeApi.setEditorState(
        shownComposableItemId,
        {
          cursor,
          selections,
          draft: codeMirrorInstance.current!.getValue()
        }
      )
    },
    [shownComposableItemId, stateChangeApi]
  )

  React.useImperativeHandle(
    ref,
    () => ({
      commitCurrentState: () => { saveEditorState() }
    }),
    [saveEditorState]
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
      if (editingItem === null) {
        codeMirrorInstance.current!.setOption('readOnly', false)
        setShouldShowDraftNotice(false)
        setShouldShowCsvNotice(false)
        setShownComposableItemId(null)
        setTimeout(() => { codeMirrorInstance.current!.focus() }, 10)
        return
      }

      if (!editingItem || shownComposableItemId === editingItem.base.id) { return }

      codeMirrorInstance.current!.save()

      const cursor = codeMirrorInstance.current!.getCursor()
      const selections = codeMirrorInstance.current!.listSelections()

      if (shownComposableItemId && editingItem.base.sql.trim() === codeMirrorInstance.current!.getValue().trim()) {
        // Revert the current shownComposableItemId because the new editingItem is equal to the previous sql.
        // This means the new editingItem spawns from the previous item.
        stateChangeApi.setEditorState(shownComposableItemId, null)
      } else {
        saveEditorState()
      }

      if (editingItem?.base.editorState?.draft && editingItem?.base.editorState?.draft.trim() !== editingItem.base.sql.trim()) {
        codeMirrorInstance.current!.setValue(editingItem?.base.editorState?.draft)

        if (!(editingItem.base instanceof DraftSql)) {
          setShouldShowDraftNotice(true)
        }
      } else {
        codeMirrorInstance.current!.setValue(editingItem?.base.isCsv ? '' : editingItem.base.sql)
        setShouldShowDraftNotice(false)
      }

      if (editingItem.base.editorState?.cursor && editingItem.base.editorState?.selections) {
        codeMirrorInstance.current!.setCursor(editingItem.base.editorState.cursor)
        codeMirrorInstance.current!.setSelections(editingItem.base.editorState.selections)
      } else {
        codeMirrorInstance.current!.setCursor(cursor)
        codeMirrorInstance.current!.setSelections(selections)
      }

      codeMirrorInstance.current!.focus()
      setShownComposableItemId(editingItem.base.id)

      codeMirrorInstance.current!.setOption('readOnly', editingItem?.base.isCsv ? 'nocursor' : false)
      setShouldShowCsvNotice(editingItem?.base.isCsv ?? false)
    },
    [editingItem, saveEditorState, shownComposableItemId, stateChangeApi]
  )

  const formatCodeEditor = React.useCallback(
    () => {
      codeMirrorInstance.current!.format()
    },
    []
  )

  const makeNewSql = React.useCallback(
    (newContent: string | null = null) => {
       
      stateChangeApi.makeDraftSql(newContent ?? codeMirrorInstance.current?.getValue() ?? '')
    },
    [stateChangeApi]
  )

  const revertSql = React.useCallback(
    () => {
      if (!editingItem) { return }

      codeMirrorInstance.current!.setValue(editingItem.base.sql)
      stateChangeApi.setEditorState(editingItem.base.id, null)
      codeMirrorInstance.current!.focus()

      setShouldShowDraftNotice(false)
    },
    [editingItem, stateChangeApi]
  )

  const runSql = React.useCallback(
    async (mode: RunSqlMode = 'default') => {
      if (isQueryLoading) { return }
      codeMirrorInstance.current!.save()

      let sql: string
      switch (mode) {
        case 'partial-new':
        case 'partial-draft': {
          const selection = codeMirrorInstance.current!.getSelection()

          if (selection) {
            sql = selection
          } else {
            sql = codeMirrorInstance.current!.getValue().trim()
          }
          break
        }
        case 'default':
          sql = codeMirrorInstance.current!.getValue().trim()
          break
        default:
          throw new Error()
      }

      if (sql === '') { return }

      let replace: Result | null = null
      switch (mode) {
        case 'partial-new':
          break
        case 'partial-draft':
          replace = (workspaceState.results.find((i) => i.base instanceof DraftResult)?.base as DraftResult) ?? new DraftResult({
            id: generateWorkspaceItemId(),
            name: DraftSheetName,
            sql,
            isCsv: false,
            count: 0,
            columns: [],
            rows: [],
            presentationType: 'table'
          })
          stateChangeApi.startLoadingDraftResult()
          break
        case 'default':
          replace = editingItem?.base instanceof DraftSql ? null : (editingItem?.base as Result) ?? null
          stateChangeApi.startLoading(editingItem?.base.id ?? null)
          break
        default:
          throw new Error()
      }

      setIsQueryLoading(true)
      try {
        const sheet = await query(sql, replace)

        stateChangeApi.addOrReplaceResult(sheet)
        stateChangeApi.setSelectedResultId(sheet.id)

        if (mode === 'default') {
          setShouldShowDraftNotice(false)

          if (editingItem?.base instanceof DraftSql) {
            stateChangeApi.discardDraftSql(editingItem.base.id)
          }
          stateChangeApi.setSelectedComposableItemId(sheet.id)
        }

        if (!replace || replace.name !== sheet.name) {
          onRenamingSheet({ sheet, isNewTable: true })
        }
      } catch (err) {
        const message = err as any as string
        let postBody: string | null = null

        try {
          if (message.includes('Could not parse string') && message.includes('format specifier')) {
            postBody = 'It looks like you are having an issue with date parsing. Please review <span class="link" onclick="window.shellApi.openExternal(\'https://duckdb.org/docs/sql/functions/dateformat.html\')">the strptime documentation</span> for accurate date parsing instruction.\n\nIf you need help, contact support@superintendent.app.'
          }
        } catch (_e) {
          // empty
        }

        void dialog.showError('Running the SQL failed', err as any as string, { action: 'querying_failed', extras: { sql } }, postBody)
      } finally {
        setIsQueryLoading(false)

        switch (mode) {
          case 'partial-new':
            break
          case 'partial-draft':
            stateChangeApi.stopLoadingDraftResult()
            break
          case 'default':
            stateChangeApi.stopLoading(editingItem?.base.id ?? null)
            break
          default:
            // eslint-disable-next-line no-unsafe-finally
            throw new Error()
        }
      }
    },
    [isQueryLoading, workspaceState.results, stateChangeApi, editingItem, onRenamingSheet]
  )

  React.useEffect(
    () => {
      codeMirrorInstance.current!.refresh()
    },
    [show]
  )

  React.useEffect(
    () => {
      const handler = (event): boolean => {
        if (!show) { return true }
        if (!(event instanceof KeyboardEvent)) { return true }

        if (event.code === 'KeyU' && (event.metaKey || event.ctrlKey)) {
          onGoToUpdateMode()
          return false
        }

        if (event.code === 'KeyN' && (event.metaKey || event.ctrlKey)) {
          makeNewSql()
          return false
        }

        if (event.code === 'Enter' && (event.metaKey || event.ctrlKey)) {
          void runSql()
          return false
        }

        if (event.code === 'Enter' && event.altKey) {
          formatCodeEditor()
          return false
        }

        if (event.code === 'KeyT' && event.shiftKey && (event.metaKey || event.ctrlKey)) {
          void runSql('partial-new')
          return false
        }

        if (event.code === 'KeyT' && (event.metaKey || event.ctrlKey)) {
          void runSql('partial-draft')
          return false
        }

        return true
      }
      document.addEventListener('keydown', handler)

      return () => {
        document.removeEventListener('keydown', handler)
      }
    },
    [runSql, makeNewSql, onGoToUpdateMode, show, formatCodeEditor]
  )

  return (
    <>
      <ContextMenu
        open={contextMenuOpenInfo !== null}
        selectedText={contextMenuOpenInfo?.selectedText ?? null}
        x={contextMenuOpenInfo?.clientX ?? null}
        y={contextMenuOpenInfo?.clientY ?? null}
        onClosing={() => { setContextMenuOpenInfo(null) }}
        onRunNewSql={() => { void runSql('partial-new') }}
        onRunDraft={() => { void runSql('partial-draft') }}
      />
      <div className="toolbarSection top" style={{ borderLeft: '1px solid #666' }}>
        <div className="inner">
          <div className="left">
            <Button
              onClick={() => { void runSql() }}
              isLoading={isQueryLoading}
              icon={<i className="fas fa-play"/>}
              testId="run-sql"
            >
              Run
              <span className="short-key">{ctrlCmdChar()} ⏎</span>
            </Button>
            <span className="separator" />
            <Button
              onClick={() => { formatCodeEditor() }}
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
              onClick={() => { makeNewSql() }}
              icon={<i className="fas fa-plus-square"/>}
              testId="new-sql"
            >
              New
              <span className="short-key">{ctrlCmdChar()} N</span>
            </Button>
          </div>
          <div className="right">
            <Button
              onClick={() => { onGoToUpdateMode() }}
              icon={<i className="fas fa-edit" />}
              testId="update-mode-button"
            >
              Update mode
              <span className="short-key">{ctrlCmdChar()} U</span>
            </Button>
            {hasValidLicense().state !== 'valid' && (
              <>
                <span className="separator" />
                <Button
                  onClick={() => { void maybeShowPurchaseNotice(true) }}
                  icon={<i className="fas fa-dollar-sign"></i>}
                  testId="new-sql"
                >
                  Buy
                </Button>
              </>
            )}
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
              zIndex: 1000
            }}
          />
        )}
        <CodeEditor
          ref={codeMirrorInstance}
          placeholder="Compose a beautiful SQL..."
          onBlur={() => { saveEditorState() }}
          onContextMenu={(info) => {
            setContextMenuOpenInfo(info)
          }}
          results={workspaceState.results}
        />
      </div>
    </>
  )
})
