import './Project.scss'
import React from 'react'
import Button from './Button'
import { ctrlCmdChar } from './constants'
import AddCsv, { type Ref as AddCsvRef } from './AddCsvModal'
import { convertFileList, exportWorkflow, getInitialFile } from '../api'
import { type Sheet } from './types'
import { type ExportedWorkflow, ExportWorkflowChannel } from '../../types'
import Tippy from '@tippyjs/react'

interface ContextMenuOpenInfo {
  sheet: Sheet
  clientX: number
  clientY: number
}

export default function Project ({
  sheets,
  selectedSheetName,
  onSheetAdded,
  onOpeningResult,
  onOpeningEditor,
  onAddingName,
  onRenamingSheet,
  onDeletingSheet
}: {
  sheets: Sheet[]
  selectedSheetName: string | null
  onSheetAdded: (sheet: Sheet) => void
  onOpeningResult: (sheet: Sheet) => void
  onOpeningEditor: (sheet: Sheet) => void
  onAddingName: (sheet: Sheet) => void
  onRenamingSheet: (name: string) => void
  onDeletingSheet: (name: string) => void
}): JSX.Element {
  const [shouldOpenAddCsv, setShouldOpenAddCsv] = React.useState<boolean>(false)
  const [openContextMenu, setOpenContextMenu] = React.useState<ContextMenuOpenInfo | null>(null)

  const addCsvRef = React.useRef<AddCsvRef>(null)
  const addFiles = React.useCallback((files: string[]) => {
    addCsvRef.current!.addFiles(files)
    setShouldOpenAddCsv(true)
  }, [addCsvRef])
  const openAddCsvDialog = React.useCallback(
    () => {
      setShouldOpenAddCsv(true)
    },
    [setShouldOpenAddCsv]
  )

  React.useEffect(() => {
    const callback = (): void => {
      const workflow: ExportedWorkflow = { sheets: [] }

      sheets.forEach((sheet) => {
        workflow.sheets.push({
          name: sheet.name,
          sql: sheet.sql,
          isCsv: sheet.isCsv,
          dependsOn: sheet.dependsOn
        })
      })

      void exportWorkflow(workflow)
    }

    const removeListener = window.ipcRenderer.on(ExportWorkflowChannel, callback)

    return () => {
      removeListener()
    }
  }, [sheets])

  React.useEffect(() => {
    const handler = (event): boolean => {
      if (event.code === 'KeyP' && (event.metaKey || event.ctrlKey)) {
        openAddCsvDialog()
        return false
      }

      return true
    }
    document.addEventListener('keydown', handler)

    return () => {
      document.removeEventListener('keydown', handler)
    }
  }, [openAddCsvDialog])

  const fileDroppedCallback = React.useCallback(
    (event: DragEvent) => {
      if (!event.dataTransfer?.files) {
        return
      }

      if (event.dataTransfer.files.length === 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      addFiles(convertFileList(event.dataTransfer?.files))
    },
    [addFiles]
  )

  React.useEffect(
    () => {
      document.addEventListener('drop', fileDroppedCallback)

      return () => {
        document.removeEventListener('drop', fileDroppedCallback)
      }
    },
    [fileDroppedCallback]
  )

  const alreadyInitialized = React.useRef<boolean>(false)
  React.useEffect(
    () => {
      if (alreadyInitialized.current) { return }
      if (!addCsvRef.current) { return }

      const file = getInitialFile()

      if (!file) { return }

      addFiles([file])
      alreadyInitialized.current = true
    },
    [addFiles]
  )

  React.useEffect(
    () => {
      const listener = (event: any, path: string): void => {
        addFiles([path])
      }
      const removeListener = window.ipcRenderer.on('open-file', listener)
      return () => {
        removeListener()
      }
    },
    [addFiles]
  )

  const sortedSheet = sheets.sort((left, right) => {
    if (left.isCsv !== right.isCsv) {
      if (left.isCsv) { return -1 } else { return 1 }
    } else {
      return left.name.toLowerCase().localeCompare(right.name.toLowerCase())
    }
  })

  const contextMenu = React.useRef<any>(null)

  return (
    <>
      <AddCsv
        ref={addCsvRef}
        isOpen={shouldOpenAddCsv}
        sheets={sheets}
        onClose={() => { setShouldOpenAddCsv(false) }}
        onAdded={(sheet) => { onSheetAdded(sheet) }}
      />
      <Tippy
        ref={contextMenu}
        placement="right-start"
        trigger="manual"
        theme="context-menu"
        appendTo={document.body}
        interactive
        arrow={false}
        offset={[0, 0]}
        getReferenceClientRect={(): DOMRect => {
          return {
            width: 0,
            height: 0,
            x: openContextMenu?.clientX ?? 0,
            y: openContextMenu?.clientY ?? 0,
            top: openContextMenu?.clientY ?? 0,
            bottom: openContextMenu?.clientY ?? 0,
            left: openContextMenu?.clientX ?? 0,
            right: openContextMenu?.clientX ?? 0,
            toJSON: () => {}
          } satisfies DOMRect
        }}
        onHidden={() => {
          setOpenContextMenu(null)
        }}
        content={
          <div className="context-menu">
            <div
              className="context-menu-item"
              onClick={() => {
                contextMenu.current._tippy.hide()
                onOpeningResult(openContextMenu!.sheet)
              }}
              data-testid="project-context-menu-view"
            >
              View
            </div>
            <div
              className="context-menu-item"
              onClick={() => {
                contextMenu.current._tippy.hide()
                onRenamingSheet(openContextMenu!.sheet.name)
              }}
              data-testid="project-context-menu-rename"
            >
              Rename
            </div>
            <div
              className="context-menu-item"
              onClick={() => {
                contextMenu.current._tippy.hide()
                onDeletingSheet(openContextMenu!.sheet.name)
              }}
              data-testid="project-context-menu-delete"
            >
              Delete
            </div>
          </div>
        }
      >
        <span/>
      </Tippy>
      <div className="toolbarSection top">
        <div className="inner">
          <Button
            onClick={() => { openAddCsvDialog() }}
            icon={<i className="fas fa-file-upload"/>}
            testId="add-files"
          >
            Add files
            <span className="short-key">
              {ctrlCmdChar()} P
            </span>
          </Button>
        </div>
      </div>
      <div className="project-panel">
        <div className="body">
          {sortedSheet.map((sheet) => {
            const icon = sheet.isCsv
              ? (
              <i className="fas fa-file-csv"></i>
                )
              : (
              <i className="fas fa-caret-square-right"></i>
                )

            return (
              <div
                key={sheet.name}
                className={`item ${sheet.name === selectedSheetName ? 'selected' : sheet.name === openContextMenu?.sheet.name ? 'contextMenuOpened' : ''}`}
                data-testid={`project-item-${sheet.name}`}
                onClick={(event) => {
                  onOpeningEditor(sheet)
                }}
                onContextMenu={(event) => {
                  setOpenContextMenu({
                    sheet,
                    clientX: event.clientX,
                    clientY: event.clientY
                  })
                  contextMenu.current._tippy.show()
                }}
              >
                {icon}
                <span className="name">{sheet.name}</span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
