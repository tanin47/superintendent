import './Project.scss'
import React from 'react'
import Button from './Button'
import { ctrlCmdChar } from './constants'
import AddCsv, { type Ref as AddCsvRef } from './AddCsvModal'
import { convertFileList, getInitialFile } from '../api'
import { Sheet, DraftSql, type ComposableItem, Result } from './types'
import { useFloating, useClientPoint, useInteractions, useDismiss, useTransitionStyles, shift } from '@floating-ui/react'
import { StateChangeApi, useDispatch, useWorkspaceContext, type ObjectWrapper } from './WorkspaceContext'
import { type RenameDialogInfo } from './RenameDialog'

interface ContextMenuOpenInfo {
  item: ObjectWrapper<ComposableItem>
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
  item: ObjectWrapper<ComposableItem> | null
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
        {item.base instanceof Sheet && (
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

function ProjectItem ({
  item,
  className,
  onContextMenu
}: {
  item: ObjectWrapper<ComposableItem>
  className?: string | null
  onContextMenu: (info: ContextMenuOpenInfo) => void
}): JSX.Element {
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  let icon = <i className="fas fa-question-circle"></i>

  if (item.base instanceof DraftSql) {
    icon = <i className="fas fa-pen-square"></i>
  } else if (item.base instanceof Sheet) {
    icon = item.base.isCsv
      ? (
    <i className="fas fa-file-csv"></i>
        )
      : (
    <i className="fas fa-caret-square-right"></i>
        )
  }

  return (
    <div
      className={`item ${className}`}
      data-testid={`project-item-${item.base.name}`}
      onClick={() => { stateChangeApi.setSelectedComposableItemId(item.base.id) }}
      onDoubleClick={() => {
        if (item.base instanceof Sheet) {
          stateChangeApi.setSelectedResultId(item.base.id)
        }
      }}
      onContextMenu={(event) => {
        onContextMenu({
          item,
          clientX: event.clientX,
          clientY: event.clientY
        })
      }}
    >
      {icon}
      <span className="name">{item.base.name}</span>
    </div>
  )
}

function sort (a: ObjectWrapper<ComposableItem>, b: ObjectWrapper<ComposableItem>): number {
  return a.base.name.localeCompare(b.base.name)
}

export default function Project ({
  selectedComposableItem,
  onRenamingSheet,
  onGoToLicense
}: {
  selectedComposableItem: ObjectWrapper<ComposableItem> | null
  onRenamingSheet: (info: RenameDialogInfo) => void
  onGoToLicense: () => void
}): JSX.Element {
  const workspaceState = useWorkspaceContext()
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const [draftSqls, setDraftSqls] = React.useState<Array<ObjectWrapper<DraftSql>>>([])
  const [csvs, setCsvs] = React.useState<Array<ObjectWrapper<Sheet>>>([])
  const [sheets, setSheets] = React.useState<Array<ObjectWrapper<Sheet>>>([])

  React.useEffect(
    () => {
      const items = [...workspaceState.draftSqls]
      items.sort(sort)
      setDraftSqls(items)
    },
    [workspaceState.draftSqls]
  )

  React.useEffect(
    () => {
      const csvs = [...workspaceState.results.filter((i) => i.base.isCsv && i.base.isComposable()).sort(sort)]
      const sheets = [...workspaceState.results.filter((i) => !i.base.isCsv && i.base.isComposable()).sort(sort)]

      setCsvs(csvs)
      setSheets(sheets)
    },
    [workspaceState.results]
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

  return (
    <>
      <AddCsv
        ref={addCsvRef}
        isOpen={shouldOpenAddCsv}
        csvs={csvs}
        onClose={() => { setShouldOpenAddCsv(false) }}
        onGoToLicense={onGoToLicense}
      />
      <ContextMenu
        open={openContextMenu !== null}
        item={openContextMenu?.item ?? null}
        x={openContextMenu?.clientX ?? null}
        y={openContextMenu?.clientY ?? null}
        onClosing={() => { setOpenContextMenu(null) }}
        onRenaming={() => { onRenamingSheet({ sheet: openContextMenu!.item.base as Sheet, isNewTable: false }) }}
        onViewing={() => { stateChangeApi.setSelectedResultId(openContextMenu!.item.base.id) }}
        onDeleting={() => {
          if (openContextMenu!.item.base instanceof DraftSql) {
            stateChangeApi.deleteDraftSql(openContextMenu!.item.base.id)
          } else if (openContextMenu!.item.base instanceof Result) {
            stateChangeApi.deleteResult(openContextMenu!.item.base.id)
          }
        }}
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
          {draftSqls.map((item) => {
            return (
              <ProjectItem
                key={item.base.id}
                item={item}
                className={`draft ${item.base.id === selectedComposableItem?.base.id ? 'selected' : item === openContextMenu?.item ? 'contextMenuOpened' : ''}`}
                onContextMenu={(info) => {
                  setOpenContextMenu(info)
                }}
              />
            )
          })}
          {csvs.map((item, index) => {
            const shouldAddTopBorder = index === 0 && draftSqls.length > 0

            return (
              <ProjectItem
                key={item.base.id}
                item={item}
                className={`${item.base.id === selectedComposableItem?.base.id ? 'selected' : item === openContextMenu?.item ? 'contextMenuOpened' : ''} ${shouldAddTopBorder ? 'top-separator' : ''}`}
                onContextMenu={(info) => {
                  setOpenContextMenu(info)
                }}
              />
            )
          })}
          {sheets.map((item, index) => {
            const shouldAddTopBorder = index === 0 && (csvs.length + draftSqls.length) > 0

            return (
              <ProjectItem
                key={item.base.id}
                item={item}
                className={`${item.base.id === selectedComposableItem?.base.id ? 'selected' : item === openContextMenu?.item ? 'contextMenuOpened' : ''} ${shouldAddTopBorder ? 'top-separator' : ''}`}
                onContextMenu={(info) => {
                  setOpenContextMenu(info)
                }}
              />
            )
          })}
        </div>
      </div>
    </>//
  )
}
