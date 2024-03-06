import './Project.scss'
import React from 'react'
import Button from './Button'
import { ctrlCmdChar } from './constants'
import AddCsv, { type Ref as AddCsvRef } from './AddCsvModal'
import { convertFileList, exportWorkflow, getInitialFile } from '../api'
import { type Sheet } from './types'
import { type ExportedWorkflow, ExportWorkflowChannel } from '../../types'
import { useFloating, useClientPoint, useInteractions, useDismiss, useTransitionStyles, shift } from '@floating-ui/react'

interface ContextMenuOpenInfo {
  sheet: Sheet
  clientX: number
  clientY: number
}

function ContextMenu ({
  open,
  onViewing,
  onRenaming,
  onDeleting,
  onClosing,
  x,
  y
}: {
  open: boolean
  onViewing: () => void
  onRenaming: () => void
  onDeleting: () => void
  onClosing: () => void
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

  if (!isMounted) { return <></> }

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
            onViewing()
            onClosing()
          }}
          data-testid="project-context-menu-view"
        >
          View
        </div>
        <div
          className="context-menu-item"
          onClick={() => {
            onRenaming()
            onClosing()
          }}
          data-testid="project-context-menu-rename"
        >
          Rename
        </div>
        <div
          className="context-menu-item"
          onClick={() => {
            onDeleting()
            onClosing()
          }}
          data-testid="project-context-menu-delete"
        >
          Delete
        </div>
      </div>
    </div>
  )
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
          isCsv: sheet.isCsv
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

  return (
    <>
      <AddCsv
        ref={addCsvRef}
        isOpen={shouldOpenAddCsv}
        sheets={sheets}
        onClose={() => { setShouldOpenAddCsv(false) }}
        onAdded={(sheet) => { onSheetAdded(sheet) }}
      />
      <ContextMenu
        open={openContextMenu !== null}
        x={openContextMenu?.clientX ?? null}
        y={openContextMenu?.clientY ?? null}
        onClosing={() => { setOpenContextMenu(null) }}
        onRenaming={() => { onRenamingSheet(openContextMenu!.sheet.name) }}
        onViewing={() => { onOpeningResult(openContextMenu!.sheet) }}
        onDeleting={() => { onDeletingSheet(openContextMenu!.sheet.name) }}
      />
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
                }}
              >
                {icon}
                <span className="name">{sheet.name}</span>
              </div>
            )
          })}
        </div>
      </div>
    </>//
  )
}
