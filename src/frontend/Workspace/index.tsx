import React, { type ReactElement } from 'react'
import './index.scss'
import { downloadCsv, drop, getInitialEditorMode, query, sort } from '../api'
import { type EditorMode, EditorModeChannel, type ExportedWorkflow, ImportWorkflowChannel } from '../../types'
import { type RunSqlMode, type Column, type PresentationType, type Sheet, DraftSheetName } from './types'
import SheetSection, { type Ref as SheetSectionRef } from './SheetSection'
import Button from './Button'
import Editor, { type Ref as EditorRef } from './Editor'
import * as dialog from './dialog'
import { formatTotal, isChartEnabled } from './helper'
import { ctrlCmdChar } from './constants'
import Project from './Project'
import ResizeBar from './ResizeBar'
import RenameDialog from './RenameDialog'

// const PresentationTypeLabel = {
//   table: 'Table',
//   line: 'Line chart',
//   pie: 'Pie chart',
//   bar: 'Bar chart'
// }

interface SheetInfo {
  name: string
  showCount: number
  totalRowCount: number
  columns: Column[]
}

function areSheetInfosEqual (left: SheetInfo | null, right: SheetInfo | null): boolean {
  if (left === right) { return true }
  if (left === null || right === null) { return false }

  if (left.columns.length !== right.columns.length) { return false }

  if (
    left.name === right.name &&
      left.showCount === right.showCount &&
      left.totalRowCount === right.totalRowCount
  ) {
    // do nothing
  } else {
    return false
  }

  for (let i = 0; i < left.columns.length; i++) {
    const leftColumn = left.columns[i]
    const rightColumn = right.columns[i]

    if (
      leftColumn.name === rightColumn.name &&
      leftColumn.maxCharWidthCount === rightColumn.maxCharWidthCount &&
      leftColumn.tpe === rightColumn.tpe
    ) {
      // do nothing
    } else {
      return false
    }
  }

  return true
}

export default function Workspace (): ReactElement {
  const [editorMode, setEditorMode] = React.useState<EditorMode>(getInitialEditorMode())
  const [sheets, setSheets] = React.useState<Sheet[]>([])
  const [editorSelectedSheet, setEditorSelectedSheet] = React.useState<Sheet | null>(null)
  const [renamingSheetName, setRenamingSheetName] = React.useState<string | null>(null)

  const [shownSheetInfo, setShownSheetInfo] = React.useState<SheetInfo | null>(null)
  const [blinkingShownSheetCount, setBlinkingShownSheetCount] = React.useState<boolean>(false)
  const blinkingShownSheetCountTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const [presentationType, setPresentationType] = React.useState<PresentationType>('table')
  const sheetSectionRef = React.useRef<SheetSectionRef>(null)

  React.useEffect(() => {
    const callback = (event, workflow: ExportedWorkflow): void => {
      setEditorSelectedSheet(null)
      setSheets((prevSheets) => {
        return [
          ...prevSheets,
          ...workflow.sheets.map((sheet) => ({
            name: sheet.name,
            isCsv: sheet.isCsv,
            sql: sheet.sql,
            count: 0,
            columns: [],
            rows: [],
            sorts: [],
            presentationType: 'table',
            scrollLeft: null,
            scrollTop: null,
            resizedColumns: {},
            selection: null,
            userSelect: null,
            editorState: null,
            isLoading: false
          } satisfies Sheet))
        ]
      })
    }
    const removeListener = window.ipcRenderer.on(ImportWorkflowChannel, callback);
    (window as any).importWorkflowHookIsLoaded = true

    return () => {
      removeListener()
    }
  }, [])

  React.useEffect(() => {
    const callback = (event, mode: any): void => { setEditorMode(mode as EditorMode) }
    const removeListener = window.ipcRenderer.on(EditorModeChannel, callback)

    return () => {
      removeListener()
    }
  }, [setEditorMode])

  const editorRef = React.useRef<EditorRef>(null)

  const [isDownloadCsvLoading, setIsDownloadCsvLoading] = React.useState<boolean>(false)

  const [editorHeight, setEditorHeight] = React.useState<number>(250)
  const [projectWidth, setProjectWidth] = React.useState<number>(250)

  const addNewSheetCallback = React.useCallback(
    (newSheet: Sheet | null, shouldSwitchEditor: boolean = true): void => {
      if (!newSheet) { return }

      setSheets((sheets) => {
        const foundIndex = sheets.findIndex((s) => s.name === newSheet.name)

        if (foundIndex > -1) {
          sheets.splice(foundIndex, 1, newSheet)
          setTimeout(() => { sheetSectionRef.current!.open(newSheet.name) }, 1)
        } else {
          sheets.push(newSheet)

          if (!newSheet.isCsv && shouldSwitchEditor) {
            setEditorSelectedSheet(sheets[sheets.length - 1])
          }
        }

        return [...sheets]
      })
    },
    []
  )

  const deleteSheetCallback = React.useCallback(
    (name: string): void => {
      const confirmMsg = `Are you sure you want to remove: ${name}?`
      if (!confirm(confirmMsg)) {
        return
      }

      void drop(name)
      const updatedSheets = sheets.filter((sheet) => sheet.name !== name)

      setSheets(updatedSheets)

      if (name === editorSelectedSheet?.name) {
        setEditorSelectedSheet(null)
      }
    },
    [sheets, editorSelectedSheet]
  )

  const runSql = React.useCallback(
    async (sql: string, selectedSheetName: string | null, mode: RunSqlMode) => {
      let shouldSwitchEditor = false
      let sheetName: string | null
      switch (mode) {
        case 'partial-new':
          sheetName = null
          break
        case 'partial-draft':
          sheetName = DraftSheetName
          break
        case 'default':
          sheetName = selectedSheetName
          shouldSwitchEditor = true
          break
        default:
          throw new Error()
      }

      const found = sheets.find((s) => s.name === sheetName)

      if (found) {
        found.isLoading = true
        setSheets([...sheets])
      }

      try {
        const sheet = await query(sql, sheetName)

        if (found) {
          found.isLoading = false
        }

        addNewSheetCallback(sheet, shouldSwitchEditor)
        return sheet
      } catch (e) {
        if (found) {
          found.isLoading = false
          setSheets([...sheets])
        }
        throw e
      }
    },
    [sheets, addNewSheetCallback]
  )

  const exportCsv = React.useCallback(
    () => {
      setIsDownloadCsvLoading(true)
      // Add some delay for the UI to be updated.
      setTimeout(
        () => {
          const tab = sheetSectionRef.current!.getSelectedTab()
          if (!tab) { return }

          downloadCsv(tab.sheet.name)
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
    []
  )
  const makeNewQuery = React.useCallback(
    () => {
      setEditorSelectedSheet(null)
      setTimeout(() => { editorRef.current!.focus() }, 10)
    },
    []
  )

  React.useEffect(() => {
    const handler = (event): boolean => {
      if (event.code === 'KeyN' && (event.metaKey || event.ctrlKey)) {
        makeNewQuery()
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
  }, [exportCsv, makeNewQuery])

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
    <div
      id="workspace"
       onDragOver={(e) => {
         e.stopPropagation()
         e.preventDefault()
       }}
    >
      <RenameDialog
        renamingSheet={sheets.find((s) => s.name === renamingSheetName) ?? null}
        onUpdated={(newName) => {
          if (renamingSheetName !== null) {
            setSheets((prevSheets) => {
              return prevSheets.map((sheet) => {
                if (sheet.name === renamingSheetName) {
                  if (editorSelectedSheet?.name === sheet.name) {
                    setEditorSelectedSheet(sheet)
                  }
                  sheet.previousName = sheet.name
                  sheet.name = newName
                }
                return sheet
              })
            })
          }
          setRenamingSheetName(null)
        }}
        onClosed={() => { setRenamingSheetName(null) }}
      />
      <div id="editorSection" style={{ height: editorHeight }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: projectWidth, display: 'flex', flexDirection: 'column' }}>
          <Project
            sheets={sheets}
            selectedSheetName={editorSelectedSheet?.name ?? null}
            onSheetAdded={(sheet) => { addNewSheetCallback(sheet) }}
            onAddingName={(sheet) => {
              editorRef.current!.addText(sheet.name)
              editorRef.current!.focus()
            }}
            onOpeningEditor={(sheet) => {
              setEditorSelectedSheet(sheet)
            }}
            onOpeningResult={(sheet) => {
              sheetSectionRef.current!.open(sheet.name)
            }}
            onRenamingSheet={(name) => { setRenamingSheetName(name) }}
            onDeletingSheet={(name) => { deleteSheetCallback(name) }}
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
            ref={editorRef}
            mode={editorMode}
            sheets={sheets}
            selectedSheet={editorSelectedSheet}
            onMakingNewQuery={() => { makeNewQuery() }}
            onRunningSql={runSql}
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
            {shownSheetInfo && (
              <>
                <span className={`total ${blinkingShownSheetCount ? 'blinking' : ''}`}>
                  <i className="fas fa-table"></i>
                  {formatTotal(shownSheetInfo.totalRowCount)}
                  {shownSheetInfo.showCount < shownSheetInfo.totalRowCount &&
                    <span className="preview">(Only {shownSheetInfo.showCount.toLocaleString('en-US')} are shown)</span>
                  }
                </span>
              </>
            )}
          </div>
          <div className="right">
            <Button
              onClick={() => { exportCsv() }}
              isLoading={isDownloadCsvLoading}
              disabled={sheets.length === 0}
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
        ref={sheetSectionRef}
        sheets={sheets}
        presentationType={presentationType}
        onSelectedSheetUpdated={(newSheet) => {
          let info: SheetInfo | null = null

          if (newSheet) {
            info = {
              name: newSheet.name,
              showCount: newSheet.rows.length,
              totalRowCount: newSheet.count,
              columns: newSheet.columns
            }
          }

          if (areSheetInfosEqual(info, shownSheetInfo)) {
            return
          }

          if (!isChartEnabled(info?.showCount)) {
            setPresentationType('table')
          }

          addNewSheetCallback(newSheet)

          setShownSheetInfo((prev) => {
            if (!!prev && !!info && prev.name === info.name && prev.totalRowCount !== info.totalRowCount) {
              if (blinkingShownSheetCountTimeoutRef.current) {
                clearInterval(blinkingShownSheetCountTimeoutRef.current)
              }

              setBlinkingShownSheetCount(true)
              blinkingShownSheetCountTimeoutRef.current = setTimeout(
                () => {
                  setBlinkingShownSheetCount(false)
                },
                1500
              )
            }

            return info
          })
        }}
        onRenamingSheet={(name) => { setRenamingSheetName(name) }}
        onSorting={(sheet, column, direction) => {
          sheet.isLoading = true
          setSheets([...sheets])
          void sort(sheet, column, direction)
            .then((sheet) => {
              addNewSheetCallback(sheet)
            })
        }}
      />
    </div>
  )
}
