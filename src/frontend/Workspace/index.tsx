import React, { type ReactElement } from 'react'
import './index.scss'
import { downloadCsv } from '../api'
import { type ExportedWorkflow, ImportWorkflowChannel } from '../../types'
import { Result } from './types'
import SheetSection from './SheetSection'
import Button from './Button'
import Editor from './Editor'
import * as dialog from './dialog'
import { formatTotal } from './helper'
import { ctrlCmdChar } from './constants'
import Project from './Project'
import ResizeBar from './ResizeBar'
import RenameDialog, { type RenameDialogInfo } from './RenameDialog'
import { DispatchContext, StateChangeApi, WorkspaceContext, reduce } from './WorkspaceContext'

export default function Workspace ({
  onGoToLicense
}: {
  onGoToLicense: () => void
}): ReactElement {
  const [workspaceState, dispatch] = React.useReducer(reduce, { items: [], selectedComposableItemId: null, selectedResultId: null })
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const selectedResult = React.useMemo(
    () => {
      return (workspaceState.items.find((i) => i.base.id === workspaceState.selectedResultId) ?? null)
    },
    [workspaceState]
  )
  const selectedComposableItem = React.useMemo(
    () => {
      return workspaceState.items.find((i) => i.base.id === workspaceState.selectedComposableItemId) ?? null
    },
    [workspaceState]
  )

  const [renamingInfo, setRenamingInfo] = React.useState<RenameDialogInfo | null>(null)

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
  const [isDownloadCsvLoading, setIsDownloadCsvLoading] = React.useState<boolean>(false)

  const [editorHeight, setEditorHeight] = React.useState<number>(250)
  const [projectWidth, setProjectWidth] = React.useState<number>(250)

  const exportCsv = React.useCallback(
    () => {
      setIsDownloadCsvLoading(true)
      // Add some delay for the UI to be updated.
      setTimeout(
        () => {
          if (!selectedResult) { return }

          downloadCsv(selectedResult.base.name)
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
    [selectedResult]
  )

  const togglePresentationType = React.useCallback(
    () => {
      if (!selectedResult) { return }

      const result = selectedResult.base as Result

      const newPresentationType = result.presentationType === 'table' ? 'chart' : 'table'
      stateChangeApi.setPresentationType(result.id, newPresentationType)
    },
    [stateChangeApi, selectedResult]
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
                selectedComposableItem={selectedComposableItem}
                onRenamingSheet={(info) => { setRenamingInfo(info) }}
                onGoToLicense={onGoToLicense}
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
              <Editor
                editingItem={selectedComposableItem}
                onRenamingSheet={(info) => { setRenamingInfo(info) }}
              />
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
                {selectedResult && (
                  <>
                    <span className='total'>
                      <i className="fas fa-list-ol"></i>
                      {formatTotal((selectedResult.base as Result).count)}
                      {(selectedResult.base as Result).rows.length < (selectedResult.base as Result).count &&
                        <span className="preview">(Only {(selectedResult.base as Result).rows.length.toLocaleString('en-US')} are shown)</span>
                      }
                    </span>
                  </>
                )}
              </div>
              <div className="right">
                {(selectedResult?.base as Result | null)?.presentationType === 'chart'
                  ? (
                      <Button
                        testId="tabularize-sheet"
                        onClick={() => { togglePresentationType() }}
                        disabled={selectedResult === null}
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
                        disabled={selectedResult === null}
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
                  disabled={selectedResult === null}
                  icon={<i className="fas fa-file-download" />}
                >
                  Export sheet
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
            results={workspaceState.items.filter((i) => i.base instanceof Result)}
            selectedResult={selectedResult}
            onRenamingSheet={(info) => { setRenamingInfo(info) }}
          />
        </div>
      </DispatchContext.Provider>
    </WorkspaceContext.Provider>
  )
}
