import React, { type ReactElement } from 'react'
import { type Sheet as SheetType, DraftResult, type Result } from './types'
import Sheet from './Sheet'
import './SheetSection.scss'
import { type ObjectWrapper, StateChangeApi, useDispatch } from './WorkspaceContext'
import { type RenameDialogInfo } from './RenameDialog'

interface Tab {
  resultId: string
}

export default function SheetSection ({
  results,
  selectedResult,
  onRenamingSheet
}: {
  results: Array<ObjectWrapper<Result>>
  selectedResult: ObjectWrapper<Result> | null
  onRenamingSheet: (info: RenameDialogInfo) => void
}): ReactElement {
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null)
  const [tabs, setTabs] = React.useState<Tab[]>([])
  const resultMap = React.useRef<Map<string, ObjectWrapper<Result>>>(new Map())
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc')

  React.useEffect(
    () => {
      let changed = false

      if (selectedResult && !tabs.find((t) => t.resultId === selectedResult.base.id)) {
        tabs.push({ resultId: selectedResult.base.id })
        changed = true
      }

      if (selectedResult === null && tabs.length > 0) {
        stateChangeApi.setSelectedResultId(tabs[0].resultId)
      }

      if (changed) {
        setTabs([...tabs])
      }
    },
    [selectedResult, stateChangeApi, tabs]
  )

  React.useEffect(
    () => {
      let changed = false

      // Add a new sheet and replace a sheet
      for (const result of results) {
        if (!resultMap.current.get(result.base.id)) {
          resultMap.current.set(result.base.id, result)
          tabs.push({ resultId: result.base.id })
          changed = true
        }
      }

      const idSet = new Set(results.map((s) => s.base.id))
      const deletedResultIds = new Set<string>()

      resultMap.current.forEach((value, key) => {
        if (idSet.has(key)) {
          // do nothing
        } else {
          deletedResultIds.add(key)
          resultMap.current.delete(key)
          changed = true
        }
      })

      const newTabs = tabs.filter((t) => !deletedResultIds.has(t.resultId))

      if (changed) {
        setTabs(newTabs)
      }
    },
    [results, tabs, stateChangeApi, resultMap]
  )

  const rearrangedCallback = React.useCallback(
    (movedIndex: number, newIndex: number): void => {
      if (movedIndex === newIndex) { return }

      const copied = [...tabs]
      const moved = copied.splice(movedIndex, 1)
      copied.splice(newIndex, 0, moved[0])
      setTabs(copied)
    },
    [tabs]
  )

  let content: JSX.Element | null = null

  if (tabs.length > 0) {
    content = (
      <>
        {selectedResult && (
          <Sheet
            result={selectedResult}
          />
        )}
        <div
          className="selector"
          data-testid="sheet-item-list"
          onDragOver={(event) => {
            if (draggedIndex === null) {
              return
            }
            event.preventDefault()
            event.stopPropagation()
          }}
          onDrop={(event) => {
            if (draggedIndex === null) {
              return
            }
            event.preventDefault()
            event.stopPropagation()
            rearrangedCallback(draggedIndex, tabs.length)
          }}
        >
          <div className="sort-button">
            <i
              className={`fas ${sortDirection === 'asc' ? 'fa-sort-alpha-down' : 'fa-sort-alpha-up'}`}
              title="Sort alphabetically"
              onClick={() => {
                tabs.sort((a, b) => {
                  if (resultMap.current.get(a.resultId)?.base instanceof DraftResult) {
                    return -100
                  } else if (resultMap.current.get(b.resultId)?.base instanceof DraftResult) {
                    return 100
                  }

                  if (resultMap.current.get(a.resultId)?.base.isCsv !== resultMap.current.get(b.resultId)?.base.isCsv) {
                    if (resultMap.current.get(a.resultId)?.base.isCsv) { return -1 } else { return 1 }
                  } else {
                    return resultMap.current.get(a.resultId)!.base.name.toLowerCase().localeCompare(resultMap.current.get(b.resultId)!.base.name.toLowerCase())
                  }
                })

                if (sortDirection === 'desc') {
                  tabs.reverse()
                }

                setTabs([...tabs])
                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
              }}
            />
          </div>
          {tabs.map((tab, index) => {
            let icon: JSX.Element
            const result = resultMap.current.get(tab.resultId)!

            if (result.base.isLoading) {
              icon = <span className="spinner" />
            } else if (result.base instanceof DraftResult) {
              icon = (<i className="fas fa-pencil-ruler icon"></i>)
            } else if (result.base.isCsv) {
              icon = (<i className="fas fa-file-csv icon"></i>)
            } else {
              icon = (<i className="fas fa-caret-square-right icon"></i>)
            }

            return (
              <div
                key={result.base.name}
                data-testid={`sheet-section-item-${result.base.name}`}
                className={`tab ${result.base.id === selectedResult?.base.id ? 'selected' : ''} ${result.base instanceof DraftResult ? 'draft' : ''}`}
                onClick={(event) => {
                  stateChangeApi.setSelectedResultId(result.base.id)
                }}
                onDoubleClick={(event) => {
                  if (result.base instanceof Sheet) {
                    onRenamingSheet({ sheet: result.base as SheetType, isNewTable: false })
                  }
                }}
                draggable={true}
                onDrag={(event) => {
                  setDraggedIndex(index)
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(event) => {
                  if (draggedIndex === null) {
                    return
                  }
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onDrop={(event) => {
                  if (draggedIndex === null) {
                    return
                  }
                  event.preventDefault()
                  event.stopPropagation()

                  if (draggedIndex === index) { return }
                  rearrangedCallback(draggedIndex, index)
                }}
              >
                {result.base.isLoading && (
                  <div className="overlay" style={{ cursor: 'pointer' }}/>
                )}
                {icon}
                <span className="label">{result.base instanceof DraftResult ? 'draft' : result.base.name}</span>
                <i
                  className="fas fa-times"
                  onClick={(event) => {
                    event.stopPropagation() // don't trigger selecting sheet.

                    const deletedIndex = tabs.findIndex((t) => t.resultId === result.base.id)

                    tabs.splice(deletedIndex, 1)
                    setTabs([...tabs])

                    if (tabs.length === 0) {
                      stateChangeApi.setSelectedResultId(null)
                    } else if (result.base.id === selectedResult?.base.id) {
                      stateChangeApi.setSelectedResultId(tabs[Math.max(0, Math.min(deletedIndex, tabs.length - 1))].resultId)
                    }
                  }}
                />
              </div>
            )
          })}
        </div>
      </>
    )
  }

  return (
    <div id="sheetSection" className={tabs.length === 0 ? 'empty' : ''}>
      {content}
    </div>
  )
}
