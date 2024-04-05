import React, { type ReactElement } from 'react'
import { type PresentationType, type Result, type Sheet as SheetType, DraftResult } from './types'
import Sheet from './Sheet'
import './SheetSection.scss'
import { StateChangeApi, useDispatch } from './WorkspaceContext'
import { type RenameDialogInfo } from './RenameDialog'

interface Tab {
  result: Result
}

export default function SheetSection ({
  results,
  selectedResult,
  onRenamingSheet,
  presentationType
}: {
  results: Result[]
  selectedResult: Result | null
  onRenamingSheet: (info: RenameDialogInfo) => void
  presentationType: PresentationType
}): ReactElement {
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null)
  const [tabs, setTabs] = React.useState<Tab[]>([])
  const [shadowResults, setShadowResults] = React.useState<Result[]>([])
  const [selectedTabIndex, setSelectedTabIndex] = React.useState<number>(0)
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc')

  React.useEffect(
    () => {
      for (let index = 0; index < tabs.length; index++) {
        if (tabs[index].result === selectedResult) {
          setSelectedTabIndex(index)
          return
        }
      }

      for (let index = 0; index < shadowResults.length; index++) {
        if (shadowResults[index] === selectedResult) {
          tabs.push({
            result: shadowResults[index]
          })
          setTabs([...tabs])
          setSelectedTabIndex(tabs.length - 1)
        }
      }
    },
    [selectedResult, shadowResults, tabs]
  )

  React.useEffect(
    () => {
      let changed = false
      const existings = new Map(shadowResults.map((s, index) => [s.name, index]))
      let newSelectedTabIndex = selectedTabIndex

      // Add a new sheet and replace a sheet
      for (let index = 0; index < results.length; index++) {
        const result = results[index]
        const currentShadowSheetIndex = existings.get(result.name) ?? existings.get(result.previousName ?? '')

        if (currentShadowSheetIndex !== undefined) {
          const currentResult = shadowResults[currentShadowSheetIndex]
          if (currentResult !== result) {
            // The sheet has been replaced upstream. Therefore, we replace the shadow sheet and the corresponding tab.
            shadowResults.splice(currentShadowSheetIndex, 1, result)

            for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
              if (result.name === tabs[tabIndex].result.name) {
                tabs[tabIndex].result = result
                break
              }
            }
            changed = true
          }
        } else {
          shadowResults.push(result)
          tabs.push({ result })
          newSelectedTabIndex = tabs.length - 1
          changed = true
        }
      }

      const sheetNameSet = new Set(results.map((s) => s.name))
      const deletedTabIndices = new Set<number>()

      for (let index = 0; index < tabs.length; index++) {
        if (!sheetNameSet.has(tabs[index].result.name)) {
          deletedTabIndices.add(index)
          changed = true
        }
      }

      const newTabs = tabs.filter((t, i) => !deletedTabIndices.has(i))

      if (changed) {
        setTabs(newTabs)
      }

      newSelectedTabIndex = Math.max(0, Math.min(newSelectedTabIndex, newTabs.length - 1))
      if (newSelectedTabIndex !== selectedTabIndex && newSelectedTabIndex < newTabs.length) {
        stateChangeApi.setSelectedResult(newTabs[newSelectedTabIndex].result)
      }

      const deletedShadowSheetIndices = new Set<number>()

      for (let index = 0; index < shadowResults.length; index++) {
        if (!sheetNameSet.has(shadowResults[index].name)) {
          deletedShadowSheetIndices.add(index)
          changed = true
        }
      }
      if (changed) {
        setShadowResults(shadowResults.filter((t, i) => !deletedShadowSheetIndices.has(i)))
      }
    },
    [selectedTabIndex, shadowResults, results, tabs, stateChangeApi]
  )

  const rearrangedCallback = React.useCallback(
    (movedIndex: number, newIndex: number): void => {
      if (movedIndex === newIndex) { return }

      const copied = [...tabs]
      const moved = copied.splice(movedIndex, 1)
      copied.splice(newIndex, 0, moved[0])
      setTabs(copied)

      // Update immediately to avoid flickering
      copied.forEach((tab, index) => {
        if (tab.result === selectedResult) {
          setSelectedTabIndex(index)
        }
      })
    },
    [tabs, selectedResult]
  )

  let content: JSX.Element | null = null

  if (tabs.length > 0) {
    content = (
      <>
        {selectedTabIndex >= 0 && selectedTabIndex < tabs.length && <Sheet
          result={tabs[selectedTabIndex].result}
        />}
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
                  if (a.result instanceof DraftResult) {
                    return -100
                  } else if (b.result instanceof DraftResult) {
                    return 100
                  }

                  if (a.result.isCsv !== b.result.isCsv) {
                    if (a.result.isCsv) { return -1 } else { return 1 }
                  } else {
                    return a.result.name.toLowerCase().localeCompare(b.result.name.toLowerCase())
                  }
                })

                if (sortDirection === 'desc') {
                  tabs.reverse()
                }

                setTabs([...tabs])
                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')

                // Update immediately to avoid flickering
                tabs.forEach((tab, index) => {
                  if (tab.result === selectedResult) {
                    setSelectedTabIndex(index)
                  }
                })
              }}
            />
          </div>
          {tabs.map((tab, index) => {
            let icon: JSX.Element
            if (tab.result.isLoading) {
              icon = <span className="spinner" />
            } else if (tab.result instanceof DraftResult) {
              icon = (<i className="fas fa-pencil-ruler icon"></i>)
            } else if (tab.result.isCsv) {
              icon = (<i className="fas fa-file-csv icon"></i>)
            } else {
              icon = (<i className="fas fa-caret-square-right icon"></i>)
            }

            return (
              <div
                key={tab.result.name}
                data-testid={`sheet-section-item-${tab.result.name}`}
                className={`tab ${selectedTabIndex === index ? 'selected' : ''} ${tab.result instanceof DraftResult ? 'draft' : ''}`}
                onClick={(event) => {
                  stateChangeApi.setSelectedResult(tab.result)
                }}
                onDoubleClick={(event) => {
                  if (tab.result instanceof Sheet) {
                    onRenamingSheet({ sheet: tab.result as SheetType, isNewTable: false })
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
                {tab.result.isLoading && (
                  <div className="overlay" style={{ cursor: 'pointer' }}/>
                )}
                {icon}
                <span className="label">{tab.result instanceof DraftResult ? 'draft' : tab.result.name}</span>
                <i
                  className="fas fa-times"
                  onClick={(event) => {
                    event.stopPropagation() // don't trigger selecting sheet.

                    const newTabs = tabs.filter((t, i) => index !== i)
                    setTabs(newTabs)

                    let newSelectedTabIndex = selectedTabIndex
                    if (newSelectedTabIndex >= newTabs.length) {
                      newSelectedTabIndex = newTabs.length - 1
                    }

                    if (newSelectedTabIndex === -1) {
                      stateChangeApi.setSelectedResult(null)
                    } else {
                      stateChangeApi.setSelectedResult(newTabs[newSelectedTabIndex].result)
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
