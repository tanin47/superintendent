import React, { type ReactElement } from 'react'
import './index.scss'
import { downloadCsv } from '../api'
import { type ExportedWorkflow, ImportWorkflowChannel } from '../../types'
import { type PresentationType, Result } from './types'
import SheetSection from './SheetSection'
import Button from './Button'
import Editor, { type Ref as EditorRef } from './Editor'
import * as dialog from './dialog'
import { formatTotal } from './helper'
import { ctrlCmdChar } from './constants'
import Project from './Project'
import ResizeBar from './ResizeBar'
import RenameDialog, { type RenameDialogInfo } from './RenameDialog'
import { DispatchContext, StateChangeApi, WorkspaceContext, reduce } from './WorkspaceContext'

export default function Workspace (): ReactElement {
  const [workspaceState, dispatch] = React.useReducer(reduce, { items: [], selectedComposableItem: null, selectedResult: null })
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const [renamingInfo, setRenamingInfo] = React.useState<RenameDialogInfo | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [presentationType, setPresentationType] = React.useState<PresentationType>('table')

  React.useEffect(
    () => {
      stateChangeApi.makeDraftSql('')
    },
    [stateChangeApi]
  )

  React.useEffect(() => {
    const callback = (event, workflow: ExportedWorkflow): void => {
      stateChangeApi.importWorkflow(workflow)
    }
    const removeListener = window.ipcRenderer.on(ImportWorkflowChannel, callback);
    (window as any).importWorkflowHookIsLoaded = true

    return () => {
      removeListener()
    }
  }, [stateChangeApi])

  const editorRef = React.useRef<EditorRef>(null)

  const [isDownloadCsvLoading, setIsDownloadCsvLoading] = React.useState<boolean>(false)

  const [editorHeight, setEditorHeight] = React.useState<number>(250)
  const [projectWidth, setProjectWidth] = React.useState<number>(250)

  const exportCsv = React.useCallback(
    () => {
      setIsDownloadCsvLoading(true)
      // Add some delay for the UI to be updated.
      setTimeout(
        () => {
          if (!workspaceState.selectedResult) { return }

          downloadCsv(workspaceState.selectedResult.name)
            .then((filePath) => {
              if (!filePath) { return }

              dialog.showSuccess('Exported!', `The sheet has been exported to: ${filePath}`)
            })
            .catch((err) => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              dialog.showError('Found an error!', err.message)
            })
            .finally(() => {
              setIsDownloadCsvLoading(false)
            })
        },
        1
      )
    },
    [workspaceState.selectedResult]
  )

  const togglePresentationType = React.useCallback(
    () => {
      if (!workspaceState.selectedResult) { return }

      const newPresentationType = workspaceState.selectedResult.presentationType === 'table' ? 'chart' : 'table'
      stateChangeApi.setPresentationType(workspaceState.selectedResult, newPresentationType)
    },
    [stateChangeApi, workspaceState.selectedResult]
  )

  React.useEffect(() => {
    const handler = (event): boolean => {
      if (event.code === 'KeyU' && (event.metaKey || event.ctrlKey)) {
        togglePresentationType()
        return false
      }

      if (event.code === 'KeyE' && (event.metaKey || event.ctrlKey)) {
        exportCsv()
        return false
      }

      return true
    }
    document.addEventListener('keydown', handler)

    return () => {
      document.removeEventListener('keydown', handler)
    }
  }, [exportCsv, togglePresentationType])

  const ensureValidSize = React.useCallback(
    () => {
      if ((projectWidth + 300) > window.innerWidth) {
        setProjectWidth(window.innerWidth - 300)
      }

      if ((editorHeight + 200) > window.innerHeight) {
        setEditorHeight(window.innerHeight - 200)
      }
    },
    [editorHeight, projectWidth]
  )

  React.useEffect(
    () => {
      window.addEventListener('resize', ensureValidSize)

      return () => {
        window.removeEventListener('resize', ensureValidSize)
      }
    },
    [ensureValidSize]
  )

  const onEditorSheetResizing = React.useCallback(
    (initial: number, dx: number, dy: number) => {
      setEditorHeight(Math.min(window.innerHeight - 200, Math.max(dy + initial, 100)))
    },
    []
  )

  return (
    <WorkspaceContext.Provider value={workspaceState}>
      <DispatchContext.Provider value={dispatch}>
        <div
          id="workspace"
          onDragOver={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
        >
          <RenameDialog
            renamingInfo={renamingInfo}
            onClosed={() => { setRenamingInfo(null) }}
          />
          <div id="editorSection" style={{ height: editorHeight }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: projectWidth, display: 'flex', flexDirection: 'column' }}>
              <Project
                onRenamingSheet={(info) => { setRenamingInfo(info) }}
              />
            </div>
            <ResizeBar
              currentSize={projectWidth}
              onResizing={(initial, dx, dy) => {
                setProjectWidth(Math.min(window.innerWidth - 300, Math.max(dx + initial, 150)))
              }}
            >
              <div className="resize-bar" style={{ left: projectWidth - 4 }} />
            </ResizeBar>
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              top: 0,
              left: projectWidth,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Editor ref={editorRef} onRenamingSheet={(info) => { setRenamingInfo(info) }}/>
            </div>
          </div>
          <div className="toolbarSection">
            <ResizeBar
              currentSize={editorHeight}
              onResizing={onEditorSheetResizing}
            >
              <div className="resize-bar" />
            </ResizeBar>
            {/* eslint-disable-next-line react/no-unknown-property */}
            <div className="inner" unselectable="on">
              <div className="left">
                {workspaceState.selectedResult && (
                  <>
                    <span className='total'>
                      <i className="fas fa-list-ol"></i>
                      {formatTotal(workspaceState.selectedResult.count)}
                      {workspaceState.selectedResult.rows.length < workspaceState.selectedResult.count &&
                        <span className="preview">(Only {workspaceState.selectedResult.rows.length.toLocaleString('en-US')} are shown)</span>
                      }
                    </span>
                  </>
                )}
              </div>
              <div className="right">
                {workspaceState.selectedResult?.presentationType === 'chart'
                  ? (
                      <Button
                        testId="tabularize-sheet"
                        onClick={() => { togglePresentationType() }}
                        disabled={workspaceState.selectedResult === null}
                        icon={<i className="fas fa-table"></i>}
                      >
                        Table
                        <span className="short-key">
                          {ctrlCmdChar()} U
                        </span>
                      </Button>
                    )
                  : (
                      <Button
                        testId="visualize-sheet"
                        onClick={() => { togglePresentationType() }}
                        disabled={workspaceState.selectedResult === null}
                        icon={<i className="fas fa-chart-bar"></i>}
                      >
                        Visualize
                        <span className="short-key">
                          {ctrlCmdChar()} U
                        </span>
                      </Button>
                    )}
                <span className="separator" />
                <Button
                  testId="export-sheet"
                  onClick={() => { exportCsv() }}
                  isLoading={isDownloadCsvLoading}
                  disabled={workspaceState.selectedResult === null}
                  icon={<i className="fas fa-file-download" />}
                >
                  Export {workspaceState.selectedResult?.presentationType === 'chart' ? 'chart' : 'sheet'}
                  <span className="short-key">
                    {ctrlCmdChar()} E
                  </span>
                </Button>
              </div>
            </div>
            <ResizeBar
              currentSize={editorHeight}
              onResizing={onEditorSheetResizing}
            >
              <div className="resize-bar" />
            </ResizeBar>
          </div>
          <SheetSection
            results={workspaceState.items.filter((i) => i instanceof Result) as Result[]}
            selectedResult={workspaceState.selectedResult}
            presentationType={presentationType}
            onRenamingSheet={(info) => { setRenamingInfo(info) }}
          />
        </div>
      </DispatchContext.Provider>
    </WorkspaceContext.Provider>
  )
}
