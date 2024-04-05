import './Project.scss'
import React from 'react'
import Button from './Button'
import { ctrlCmdChar } from './constants'
import AddCsv, { type Ref as AddCsvRef } from './AddCsvModal'
import { convertFileList, exportWorkflow, getInitialFile } from '../api'
import { Sheet, DraftSql, type WorkspaceItem } from './types'
import { type ExportedWorkflow, ExportWorkflowChannel } from '../../types'
import { useFloating, useClientPoint, useInteractions, useDismiss, useTransitionStyles, shift } from '@floating-ui/react'
import { StateChangeApi, useDispatch, useWorkspaceContext } from './WorkspaceContext'
import { type RenameDialogInfo } from './RenameDialog'

interface ContextMenuOpenInfo {
  item: WorkspaceItem
  clientX: number
  clientY: number
}

function ContextMenu ({
  open,
  onViewing,
  onRenaming,
  onDeleting,
  onClosing,
  item,
  x,
  y
}: {
  open: boolean
  onViewing: () => void
  onRenaming: () => void
  onDeleting: () => void
  onClosing: () => void
  item: WorkspaceItem | null
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

  if (!isMounted || !item) { return <></> }

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
        {item instanceof Sheet && (
          <>
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
          </>
        )}
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
  onRenamingSheet
}: {
  onRenamingSheet: (info: RenameDialogInfo) => void
}): JSX.Element {
  const workspaceState = useWorkspaceContext()
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const [composableItems, setComposableItems] = React.useState<WorkspaceItem[]>([])

  React.useEffect(
    () => {
      setComposableItems(workspaceState.items.filter((i) => i.isComposable()))
    },
    [workspaceState.items]
  )

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

      composableItems.forEach((sheet) => {
        workflow.sheets.push({
          name: sheet.name,
          sql: sheet.sql,
          isCsv: sheet.getIsCsv()
        })
      })

      void exportWorkflow(workflow)
    }

    const removeListener = window.ipcRenderer.on(ExportWorkflowChannel, callback)

    return () => {
      removeListener()
    }
  }, [composableItems])

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

  const sortedItems = composableItems.sort((left, right) => {
    if (left.getRank() !== right.getRank()) {
      return left.getRank() - right.getRank()
    } else {
      return left.name.toLowerCase().localeCompare(right.name.toLowerCase())
    }
  })

  return (
    <>
      <AddCsv
        ref={addCsvRef}
        isOpen={shouldOpenAddCsv}
        csvs={composableItems.filter((i) => i.getIsCsv()) as Sheet[]}
        onClose={() => { setShouldOpenAddCsv(false) }}
      />
      <ContextMenu
        open={openContextMenu !== null}
        item={openContextMenu?.item ?? null}
        x={openContextMenu?.clientX ?? null}
        y={openContextMenu?.clientY ?? null}
        onClosing={() => { setOpenContextMenu(null) }}
        onRenaming={() => { onRenamingSheet({ sheet: openContextMenu!.item as Sheet, isNewTable: false }) }}
        onViewing={() => { stateChangeApi.setSelectedResult(openContextMenu!.item as Sheet) }}
        onDeleting={() => { stateChangeApi.deleteComposableItem(openContextMenu!.item) }}
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
          {sortedItems.map((item, index) => {
            const shouldAddTopBorder = index >= 1 && item.getRank() !== sortedItems[index - 1].getRank()

            let icon = <i className="fas fa-question-circle"></i>

            if (item instanceof DraftSql) {
              icon = <i className="fas fa-pen-square"></i>
            } else if (item instanceof Sheet) {
              icon = item.isCsv
                ? (
              <i className="fas fa-file-csv"></i>
                  )
                : (
              <i className="fas fa-caret-square-right"></i>
                  )
            }

            return (
              <div
                key={item.id}
                className={`item ${item === workspaceState.selectedComposableItem ? 'selected' : item === openContextMenu?.item ? 'contextMenuOpened' : ''} ${shouldAddTopBorder ? 'top-separator' : ''} ${item instanceof DraftSql ? 'draft' : ''}`}
                data-testid={`project-item-${item.name}`}
                onClick={(event) => { stateChangeApi.setSelectedComposableItem(item) }}
                onDoubleClick={() => {
                  if (item instanceof Sheet) {
                    stateChangeApi.setSelectedResult(item)
                  }
                }}
                onContextMenu={(event) => {
                  setOpenContextMenu({
                    item,
                    clientX: event.clientX,
                    clientY: event.clientY
                  })
                }}
              >
                {icon}
                <span className="name">{item.name}</span>
              </div>
            )
          })}
        </div>
      </div>
    </>//
  )
}
