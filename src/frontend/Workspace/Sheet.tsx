import React, { type ForwardedRef } from 'react'
import { type Sheet, type Selection, type UserSelectTarget, type PresentationType } from './types'
import { Chart, type ChartType, registerables } from 'chart.js'
import randomColor from 'randomcolor'
import { VariableSizeGrid as BaseGrid } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import InfiniteLoader from 'react-window-infinite-loader'
import { loadMore, copy } from '../api'
import './Sheet.scss'
import { type SortDirection } from '../../types'
import CopyingModal from './CopyingModal'
import { isChartEnabled, makeCopy } from './helper'

interface CopyingData {
  cellCount: number
}

const canvas: HTMLCanvasElement = document.createElement('canvas')

const MIN_CELL_WIDTH = 30

function getTextWidth (text: string, font: string): number {
  const lines = text.split('\n')
  let width = 0

  lines.forEach((line) => {
    const context = canvas.getContext('2d')!
    context.font = font
    const metrics = context.measureText(line)
    width = Math.max(width, metrics.width)
  })

  return Math.ceil(width) + 9 // for padding
}

function getRowHeight (row: string[]): number {
  if ((row as any).height) {
    return (row as any).height
  }
  const context = canvas.getContext('2d')!
  context.font = '12px JetBrains Mono'

  let height = 20
  row.forEach((value) => {
    height = Math.max(height, `${value}`.split('\n').length * 20)
  });

  (row as any).height = Math.ceil(height) + 1
  return (row as any).height
}

function getCellIndicies (child: React.ReactNode): { row: number, column: number } {
  // @ts-expect-error ReactNode doesn't have props???
  return { row: child.props.rowIndex, column: child.props.columnIndex }
}

function getShownIndices (children: React.ReactNode): { from: { row: number, column: number }, to: { row: number, column: number } } {
  let minRow = Infinity
  let maxRow = -Infinity
  let minColumn = Infinity
  let maxColumn = -Infinity

  React.Children.forEach(children, (child) => {
    const { row, column } = getCellIndicies(child)
    minRow = Math.min(minRow, row)
    maxRow = Math.max(maxRow, row)
    minColumn = Math.min(minColumn, column)
    maxColumn = Math.max(maxColumn, column)
  })

  return {
    from: {
      row: minRow,
      column: minColumn
    },
    to: {
      row: maxRow,
      column: maxColumn
    }
  }
}

function useInnerElementType (
  cell: any,
  columnWidths: number[],
  computeRowHeight: (index: number) => number,
  computeCumulativeRowHeight: (index: number) => number
// eslint-disable-next-line @typescript-eslint/ban-types
): React.ForwardRefExoticComponent<React.PropsWithoutRef<{}> & React.RefAttributes<HTMLDivElement>> {
  return React.useMemo(
    () =>
      // eslint-disable-next-line react/display-name
      React.forwardRef((props, ref: ForwardedRef<HTMLDivElement>) => {
        // eslint-disable-next-line react/prop-types
        const shownIndices = getShownIndices(props.children)

        // eslint-disable-next-line react/prop-types
        const children = React.Children.map(props.children, (child) => {
          const { row, column } = getCellIndicies(child)

          // do not show non-sticky cell
          if (row === 0 || column === 0) {
            return null
          }

          return child
        })!

        const cumulativeColumnWidths: number[] = [columnWidths[0]]
        for (let i = 1; i < columnWidths.length; i++) {
          cumulativeColumnWidths[i] = columnWidths[i] + cumulativeColumnWidths[i - 1]
        }

        children.push(
          React.createElement(cell, {
            key: '0:0',
            rowIndex: 0,
            columnIndex: 0,
            style: {
              boxSizing: 'border-box',
              display: 'inline-flex',
              minWidth: columnWidths[0],
              maxWidth: columnWidths[0],
              width: columnWidths[0],
              height: computeRowHeight(0),
              position: 'sticky',
              top: 0,
              left: 0,
              zIndex: 4
            }
          })
        )

        const shownColumnsCount = shownIndices.to.column - shownIndices.from.column

        for (let i = 1; i <= shownColumnsCount; i += 1) {
          const columnIndex = i + shownIndices.from.column
          const rowIndex = 0
          const width = columnWidths[columnIndex]
          const height = computeRowHeight(rowIndex)

          const marginLeft = i === 1 ? cumulativeColumnWidths[columnIndex - 1] - columnWidths[0] : undefined

          children.push(
            React.createElement(cell, {
              key: `${rowIndex}:${columnIndex}`,
              rowIndex,
              columnIndex,
              style: {
                boxSizing: 'border-box',
                marginLeft,
                display: 'inline-flex',
                width,
                height,
                position: 'sticky',
                top: 0,
                zIndex: 3
              }
            })
          )
        }

        const shownRowsCount = shownIndices.to.row - shownIndices.from.row
        const headerRowHeight = computeRowHeight(0)

        for (let i = 1; i <= shownRowsCount; i += 1) {
          const columnIndex = 0
          const rowIndex = i + shownIndices.from.row
          const width = columnWidths[columnIndex]
          const height = computeRowHeight(rowIndex)

          const marginTop = i === 1 ? computeCumulativeRowHeight(rowIndex - 1) - headerRowHeight : undefined

          children.push(
            React.createElement(cell, {
              key: `${rowIndex}:${columnIndex}`,
              rowIndex,
              columnIndex,
              style: {
                boxSizing: 'border-box',
                marginTop,
                width,
                height,
                position: 'sticky',
                left: 0,
                zIndex: 2
              }
            })
          )
        }

        return (
          <div ref={ref} {...props}>
            {children}
          </div>
        )
      }),
    [cell, columnWidths, computeCumulativeRowHeight, computeRowHeight]
  )
}

const Grid = React.forwardRef(function Grid ({
  rowCount,
  columnCount,
  computeRowHeight,
  computeCumulativeRowHeight,
  columnWidths,
  width,
  height,
  initialScrollLeft,
  initialScrollTop,
  onScrolled,
  infiniteLoaderRef,
  onItemsRendered,
  onSorting,
  children
}: {
  rowCount: number
  columnCount: number
  computeRowHeight: (index: number) => number
  computeCumulativeRowHeight: (index: number) => number
  columnWidths: number[]
  width: number
  height: number
  initialScrollLeft: number
  initialScrollTop: number
  onScrolled: (left: number, top: number) => void
  onItemsRendered: (params: any) => void
  infiniteLoaderRef: (r: any) => void
  onSorting: (sheet: Sheet, column: string, direction: SortDirection) => void
  children: any
},
ref: React.Ref<unknown>): JSX.Element {
  const baseGridRef = React.useRef<any>()

  React.useImperativeHandle(ref, () => ({
    updateColumn: (colIndex: number) => {
      if (baseGridRef.current) {
        baseGridRef.current.resetAfterColumnIndex(colIndex, true)
      }
    },
    updateRow: (rowIndex: number) => {
      if (baseGridRef.current) {
        baseGridRef.current.resetAfterRowIndex(rowIndex, true)
      }
    }
  }), [baseGridRef])

  return (
    <BaseGrid
      ref={(r) => {
        baseGridRef.current = r
        infiniteLoaderRef(r)
      }}
      rowCount={rowCount}
      rowHeight={computeRowHeight}
      columnCount={columnCount}
      columnWidth={(index: number) => {
        if (index >= columnWidths.length) {
          return 0
        } else {
          return columnWidths[index]
        }
      }}
      width={width}
      height={height}
      initialScrollLeft={initialScrollLeft}
      initialScrollTop={initialScrollTop}
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      onScroll={({ scrollLeft, scrollTop }) => { onScrolled(scrollLeft, scrollTop) }}
      onItemsRendered={({
        visibleRowStartIndex,
        visibleRowStopIndex,
        overscanRowStopIndex,
        overscanRowStartIndex
      }) => {
        onItemsRendered({
          overscanStartIndex: overscanRowStartIndex,
          overscanStopIndex: overscanRowStopIndex,
          visibleStartIndex: visibleRowStartIndex,
          visibleStopIndex: visibleRowStopIndex
        })
      }}
      innerElementType={useInnerElementType(
        children,
        columnWidths,
        computeRowHeight,
        computeCumulativeRowHeight
      )}
    >
      {children}
    </BaseGrid>
  )
})

function Table ({
  sheet,
  onSelectedSheetUpdated,
  onCopyingStarted,
  onCopyingFinished,
  onSorting
}: {
  sheet: Sheet
  onSelectedSheetUpdated: (sheet: Sheet | null) => void
  onCopyingStarted: (data: CopyingData) => void
  onCopyingFinished: () => void
  onSorting: (sheet: Sheet, column: string, direction: SortDirection) => void
}): JSX.Element {
  const [, setForceUpdate] = React.useState<number>(0)
  const columnWidths = React.useRef<number[]>([])

  React.useEffect(
    () => {
      columnWidths.current = [sheet.resizedColumns?.[0] ? sheet.resizedColumns[0] : MIN_CELL_WIDTH]

      sheet.columns.forEach((column, index) => {
        if (sheet.resizedColumns?.[index + 1]) {
          columnWidths.current.push(sheet.resizedColumns[index + 1])
          return
        }

        const width = Math.max(
          getTextWidth(column.name, 'bold 12px JetBrains Mono') + 17, // +17 for the sorting icon.
          getTextWidth('#'.repeat(column.maxCharWidthCount), '12px JetBrains Mono'),
          MIN_CELL_WIDTH
        )

        columnWidths.current.push(width)
      })

      gridRef.current?.updateColumn(0)
      gridRef.current?.updateRow(0)
      setForceUpdate(forceUpdate => forceUpdate + 1)
    },
    [sheet]
  )

  const [userSelect, _setUserSelect] = React.useState<UserSelectTarget | null>(null)
  const setUserSelect = React.useCallback(
    (newUserSelect: UserSelectTarget | null) => {
      _setUserSelect(makeCopy(newUserSelect))
      sheet.userSelect = makeCopy(newUserSelect)
    },
    [sheet]
  )
  const doubleClickHandler = React.useCallback(
    (rowIndex: number, colIndex: number) => (event: React.MouseEvent) => {
      if (event.detail < 2) return // not a double click.
      if (userSelect && userSelect.rowIndex === rowIndex && userSelect.colIndex === colIndex) return // selecting text the cell.
      setUserSelect({ rowIndex, colIndex })
    },
    [userSelect, setUserSelect]
  )

  const [selection, _setSelection] = React.useState<Selection | null>(null)
  const setSelection = React.useCallback(
    (newSelection: Selection | null) => {
      _setSelection(makeCopy(newSelection))
      sheet.selection = makeCopy(newSelection)
    },
    [sheet]
  )
  const [isSelecting, setIsSelecting] = React.useState<boolean>(false)

  React.useEffect(
    () => {
      _setSelection(sheet.selection)
      _setUserSelect(sheet.userSelect)
    },
    [sheet, _setSelection, _setUserSelect]
  )

  const startSelection = React.useCallback(
    (rowIndex: number, colIndex: number) => (event: React.MouseEvent) => {
      if (event.button !== 0) return // not a left click
      if (event.detail >= 2) return // A double click is for selecting the text.
      if (userSelect && userSelect.rowIndex === rowIndex && userSelect.colIndex === colIndex) return // selecting text the cell.
      setIsSelecting(true)
      const newSelection = {
        startRow: rowIndex,
        endRow: rowIndex,
        startCol: colIndex,
        endCol: colIndex
      }
      setSelection(newSelection)
      setUserSelect(null)
    },
    [userSelect, setSelection, setUserSelect]
  )

  const addSelection = React.useCallback(
    (rowIndex: number, colIndex: number) => (event: React.MouseEvent) => {
      if (!isSelecting) return
      if (selection === null) return

      const newSelection = {
        startRow: selection.startRow,
        endRow: rowIndex,
        startCol: selection.startCol,
        endCol: colIndex
      }

      setSelection(newSelection)
    },
    [setSelection, selection, isSelecting]
  )

  const mouseDownX = React.useRef<number>(0)
  const mouseDownColWidth = React.useRef<number>(0)
  const resizingColIndex = React.useRef<number | null>(null)
  const gridRef = React.useRef<any>(null)

  const resizeColMouseDownHandler = React.useCallback(
    (colIndex: number) => (event: React.MouseEvent) => {
      if (!sheet.resizedColumns) {
        sheet.resizedColumns = {}
      }

      if (!sheet.resizedColumns[colIndex]) {
        sheet.resizedColumns[colIndex] = columnWidths.current[colIndex]
      }
      mouseDownX.current = event.clientX
      mouseDownColWidth.current = sheet.resizedColumns[colIndex]
      resizingColIndex.current = colIndex

      event.stopPropagation()
    },
    [sheet]
  )

  React.useEffect(() => {
    const handler = (event: MouseEvent): void => {
      if (resizingColIndex.current === null) { return }
      if (!gridRef.current) { return }

      sheet.resizedColumns[resizingColIndex.current] = Math.max(event.clientX - mouseDownX.current + mouseDownColWidth.current, MIN_CELL_WIDTH)
      columnWidths.current[resizingColIndex.current] = sheet.resizedColumns[resizingColIndex.current]

      gridRef.current.updateColumn(resizingColIndex.current)
    }
    document.addEventListener('mousemove', handler)

    return () => {
      document.removeEventListener('mousemove', handler)
    }
  }, [sheet])

  React.useEffect(() => {
    const handler = (event: MouseEvent): void => {
      if (resizingColIndex.current !== null) {
        gridRef.current.updateColumn(resizingColIndex.current)
        resizingColIndex.current = null
      }

      if (isSelecting) {
        setIsSelecting(false)
      }
    }
    document.addEventListener('mouseup', handler)

    return () => {
      document.removeEventListener('mouseup', handler)
    }
  }, [isSelecting])

  React.useEffect(() => {
    const handler = (event: any): void => {
      if (userSelect !== null) return // selecting text instead
      if (event.target?.tagName.toLocaleLowerCase() === 'textarea') return // The target is a text area. We skip this custom copy logic.
      if (selection === null) return

      let cellCount = 0

      let startRow = Math.min(selection.startRow, selection.endRow)
      let endRow = Math.max(selection.startRow, selection.endRow)
      let startCol = Math.min(selection.startCol, selection.endCol)
      let endCol = Math.max(selection.startCol, selection.endCol)
      let includeColumnNames = false
      let includeRowNumbers = false

      if (startRow === 0) {
        includeColumnNames = true
      } else {
        startRow--
      }

      if (startCol === 0) {
        includeRowNumbers = true
      } else {
        startCol--
      }

      endRow = endRow === 0 ? sheet.count - 1 : endRow - 1
      endCol = endCol === 0 ? sheet.columns.length - 1 : endCol - 1

      const copySelection = {
        columns: sheet.columns.slice(startCol, endCol + 1).map((c, i) => c.name),
        startRow,
        endRow,
        includeRowNumbers,
        includeColumnNames
      }
      cellCount = (endRow - startRow + 1) * (endCol - startCol + 1)

      onCopyingStarted({ cellCount })
      void copy(sheet.name, copySelection)
        .then((result) => {
          setTimeout(
            () => { onCopyingFinished() },
            300
          )
        })
        .catch((e) => {
          console.log(e)
          alert('Error while copying.')
          onCopyingFinished()
        })

      event.stopPropagation()
      event.preventDefault()
    }

    document.addEventListener('copy', handler)
    document.addEventListener('cut', handler)

    return () => {
      document.removeEventListener('copy', handler)
      document.removeEventListener('cut', handler)
    }
  }, [onCopyingFinished, onCopyingStarted, selection, sheet, userSelect])

  const isWithinRange = (value: number, start: number, end: number): boolean => {
    return (start <= value && value <= end) || (end <= value && value <= start)
  }

  const Cell = ({ columnIndex, rowIndex, style }: { columnIndex: number, rowIndex: number, style: any }): JSX.Element | null => {
    // There's a race condition between sheet and columnWidths because columnWidths is a ref.
    // There's a test that tests this bug.
    if ((columnIndex - 1) >= sheet.columns.length) {
      return null
    }

    let backgroundColor = '#fff'

    if (
      !!selection &&
      (
        (selection.startCol === 0 && selection.endCol === 0 && selection.startRow === 0 && selection.endRow === 0) || // all
        (selection.startCol === 0 && selection.endCol === 0 && isWithinRange(rowIndex, selection.startRow, selection.endRow)) || // whole rows
        (selection.startRow === 0 && selection.endRow === 0 && isWithinRange(columnIndex, selection.startCol, selection.endCol)) || // whole columns
        (
          isWithinRange(rowIndex, selection.startRow, selection.endRow) &&
          isWithinRange(columnIndex, selection.startCol, selection.endCol)
        )
      )
    ) {
      if (columnIndex === 0 || rowIndex === 0) { // the row number or the header column
        backgroundColor = '#77dd77'
      } else {
        backgroundColor = '#DAF7A6'
      }
    } else {
      if (columnIndex === 0 || rowIndex === 0) { // the row number column
        backgroundColor = '#eee'
      }
    }

    let userSelectStyle: Record<string, string> = { userSelect: 'none' }
    if (!!userSelect && userSelect.rowIndex === rowIndex && userSelect.colIndex === columnIndex) {
      userSelectStyle = {
        userSelect: 'text',
        borderColor: '#80bdff',
        outline: '0',
        boxShadow: '0 0 0 .2rem rgba(0, 123, 255, .25)',
        cursor: 'text',
        zIndex: '1000'
      }
    }

    if (rowIndex === 0) {
      let sortClass = 'unsort fa-sort'
      let direction: SortDirection = 'none'

      if (sheet.sorts && columnIndex > 0) {
        const columnName = sheet.columns[columnIndex - 1].name
        direction = sheet.sorts.find((s) => s.name === columnName)?.direction ?? 'none'

        if (direction !== 'none') {
          const icon = direction === 'asc' ? 'fa-sort-alpha-down' : 'fa-sort-alpha-up'
          sortClass = `${direction} ${icon}`
        }
      }

      return (
        <div
          key={`column-${columnIndex}`}
          className="cell"
          data-testid={`cell-${rowIndex}-${columnIndex}`}
          style={{
            boxSizing: 'border-box',
            borderRight: '1px solid #ccc',
            borderBottom: 'thin solid #ccc',
            maxWidth: `${columnWidths[columnIndex]}px`,
            minWidth: `${columnWidths[columnIndex]}px`,
            width: `${columnWidths[columnIndex]}px`,
            paddingLeft: '4px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            fontWeight: 'bold',
            backgroundColor,
            lineHeight: '20px',
            textOverflow: 'ellipsis',
            verticalAlign: 'middle',
            whiteSpace: 'pre',
            overflow: 'hidden',
            userSelect: 'none',
            textAlign: columnIndex === 0 ? 'center' : 'left',
            ...style
          }}
          onCopy={() => {}}
          onMouseDown={startSelection(rowIndex, columnIndex)}
          onMouseEnter={addSelection(rowIndex, columnIndex)}
        >
          {columnIndex > 0 && (
            <>
              <div
                className="resize-column-left-bar"
                onMouseDown={resizeColMouseDownHandler(columnIndex - 1)}

              />
              <i
                className={`fas sort ${sortClass}`}
                data-testid="sort-button"
                tabIndex={-1}
                onMouseDown={(event) => {
                  event.stopPropagation()
                }}
                onClick={(event) => {
                  sheet.sorts ||= []
                  const columnName = sheet.columns[columnIndex - 1].name
                  let newDirection: SortDirection
                  if (direction === 'asc') {
                    newDirection = 'desc'
                  } else if (direction === 'desc') {
                    newDirection = 'none'
                  } else {
                    newDirection = 'asc'
                  }
                  onSorting(sheet, columnName, newDirection)
                  event.stopPropagation()
                }}
              ></i>
            </>
          )}
          {columnIndex === 0 ? '\u00A0' : sheet.columns[columnIndex - 1].name}
          <div
            className="resize-column-right-bar"
            onMouseDown={resizeColMouseDownHandler(columnIndex)}
          />
        </div>
      )
    } else if (rowIndex === sheet.rows.length + 1) {
      return (
        <div
          key={`loading-next-${columnIndex}`}
          data-testid={`cell-${rowIndex}-${columnIndex}`}
          style={{
            boxSizing: 'border-box',
            maxWidth: `${columnWidths[columnIndex]}px`,
            minWidth: `${columnWidths[columnIndex]}px`,
            width: `${columnWidths[columnIndex]}px`,
            paddingLeft: '4px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            fontWeight: 'bold',
            backgroundColor: '#ccc',
            lineHeight: '20px',
            textOverflow: 'ellipsis',
            whiteSpace: 'pre',
            overflow: 'hidden',
            userSelect: 'none',
            ...style
          }}
        >
          &nbsp;
        </div>
      )
    } else {
      const value = columnIndex === 0 ? rowIndex : sheet.rows[rowIndex - 1][columnIndex - 1]
      let nullStyles = {}
      let renderedValue = value

      if (value === null || value === undefined) {
        renderedValue = 'NULL'
        nullStyles = {
          fontStyle: 'italic',
          color: '#666',
          fontSize: '8px'
        }
      }

      return (
        <div
          key={`cell-${rowIndex}-${columnIndex}`}
          className="cell"
          data-testid={`cell-${rowIndex}-${columnIndex}`}
          style={{
            boxSizing: 'border-box',
            borderRight: '1px solid #ccc',
            borderBottom: 'thin solid #ccc',
            maxWidth: `${columnWidths[columnIndex]}px`,
            minWidth: `${columnWidths[columnIndex]}px`,
            width: `${columnWidths[columnIndex]}px`,
            paddingLeft: '3px',
            paddingRight: '3px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: columnIndex === 0 ? '8px' : '12px',
            backgroundColor,
            textAlign: columnIndex === 0 ? 'right' : 'left',
            lineHeight: '20px',
            textOverflow: 'ellipsis',
            whiteSpace: 'pre',
            overflow: 'hidden',
            ...userSelectStyle,
            ...style,
            ...nullStyles
          }}
          onMouseDown={startSelection(rowIndex, columnIndex)}
          onMouseEnter={addSelection(rowIndex, columnIndex)}
          onClick={doubleClickHandler(rowIndex, columnIndex)}
        >
          {renderedValue.toString()}
        </div>
      )
    }
  }

  const gridRowCount = sheet.rows.length + 1 + ((sheet.rows.length < sheet.count) ? 1 : 0)

  const computeRowHeight = React.useCallback(
    (index: number) => {
      if (index === 0) {
        return getRowHeight(sheet.columns.map((c) => c.name))
      } else if (index === sheet.rows.length + 1) {
        return 20
      } else {
        return getRowHeight(sheet.rows[index - 1])
      }
    },
    [sheet]
  )

  const computeCumulativeRowHeight = React.useCallback(
    (index: number) => {
      if (index === 0) {
        return getRowHeight(sheet.columns.map((c) => c.name))
      } else if (index === sheet.rows.length + 1) {
        return 20 + computeCumulativeRowHeight(sheet.rows.length)
      } else {
        const row = sheet.rows[index - 1]
        if ((row as any).cumulativeHeight) {
          return (row as any).cumulativeHeight
        }

        let i = index
        let cumulativeHeight = computeRowHeight(i)
        i--

        for (;i >= 0; i--) {
          if (i > 0 && i < (sheet.rows.length + 1)) {
            const thisRow = sheet.rows[i - 1]

            if ((thisRow as any).cumulativeHeight) {
              cumulativeHeight += (thisRow as any).cumulativeHeight
              break
            }
          }
          cumulativeHeight += computeRowHeight(i)
        }

        (row as any).cumulativeHeight = cumulativeHeight
        return (row as any).cumulativeHeight
      }
    },
    [sheet, computeRowHeight]
  )

  const loadMoreItems = React.useCallback(
    async (startIndex: number, stopIndex: number): Promise<void> => {
      await loadMore(sheet.name, sheet.rows.length)
        .then((rows) => {
          const current = gridRef.current // setForceUpdate clears gridRef, so we need to save it first.
          const loadingRow = sheet.rows.length
          sheet.rows = sheet.rows.concat(rows)
          setForceUpdate((n) => n + 1)
          onSelectedSheetUpdated(sheet)

          if (current) {
            current.updateRow(loadingRow) // update the height of the load more row.
          }
        })
    },
    [sheet, onSelectedSheetUpdated]
  )

  const isItemLoaded = React.useCallback(
    (index) => (index < (sheet.rows.length + 1)),
    [sheet]
  )

  return (
    <AutoSizer>
      {({ height, width }) => {
        return (
          <InfiniteLoader
            itemCount={gridRowCount}
            isItemLoaded={isItemLoaded}
            loadMoreItems={loadMoreItems}
          >
            {({ onItemsRendered, ref }) => (
              <Grid
                ref={gridRef}
                infiniteLoaderRef={ref}
                key={sheet.name}
                rowCount={gridRowCount}
                computeRowHeight={computeRowHeight}
                computeCumulativeRowHeight={computeCumulativeRowHeight}
                columnCount={columnWidths.current.length}
                columnWidths={columnWidths.current}
                initialScrollLeft={sheet.scrollLeft ?? 0}
                initialScrollTop={sheet.scrollTop ?? 0}
                width={width}
                height={height}
                onItemsRendered={onItemsRendered}
                onSorting={onSorting}
                onScrolled={(left, top) => {
                  sheet.scrollLeft = left
                  sheet.scrollTop = top
                }}
              >
                {Cell}
              </Grid>
            )}
          </InfiniteLoader>
        )
      }}
    </AutoSizer>
  )
}

function Graph ({ type, sheet }: { type: ChartType, sheet: Sheet }): JSX.Element {
  const chartRef = React.useRef<any>(null)

  React.useEffect(
    () => {
      const ctx = chartRef.current?.getContext('2d')

      if (!ctx) { return }

      let colorOptionsMap: { backgroundColor?: string[], borderColor?: string } = {}

      let colors = randomColor({
        count: sheet.columns.length,
        seed: 42
      })

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const instance = new Chart(ctx, {
        type,
        data: {
          labels: sheet.rows.map((r) => r[0]),
          datasets: sheet.columns.slice(1).map((column, index) => {
            if (type === 'pie') {
              colors = randomColor({
                count: sheet.rows.length,
                seed: 42
              })
              colorOptionsMap = { backgroundColor: sheet.rows.map((r, rowIndex) => colors[rowIndex]) }
            } else {
              colorOptionsMap = {
                borderColor: colors[index],
                backgroundColor: sheet.rows.map(() => colors[index])
              }
            }
            return {
              label: column.name,
              data: sheet.rows.map((r) => parseFloat(r[index + 1])),
              ...colorOptionsMap
            }
          })
        },
        options: {
          maintainAspectRatio: false,
          normalized: true
        }
      })

      return () => {
        instance.destroy()
      }
    },
    [sheet, type]
  )

  return (
    <canvas ref={chartRef} />
  )
}

export default function SheetComponent ({
  sheet,
  presentationType,
  onSelectedSheetUpdated,
  onSorting
}: {
  sheet: Sheet
  presentationType: PresentationType
  onSelectedSheetUpdated: (sheet: Sheet | null) => void
  onSorting: (sheet: Sheet, column: string, direction: SortDirection) => void
}): JSX.Element {
  React.useEffect(
    () => {
      Chart.register(...registerables)
    },
    []
  )
  const [copyingData, setCopyingData] = React.useState<CopyingData | null>(null)

  if (sheet.columns.length === 0) {
    let msg = `Please run ${sheet.name} in order to see the result.`

    if (sheet.isCsv) {
      msg = `Please load the CSV into ${sheet.name} in order to see the result.`
    }
    return <div className="sheet" tabIndex={-1}><div className="empty-warning">{msg}</div></div>
  }

  let view: JSX.Element

  let updatedPresentationType = presentationType

  if (!isChartEnabled(sheet.rows.length)) { updatedPresentationType = 'table' }

  switch (updatedPresentationType) {
    case 'table':
      view = <Table
        sheet={sheet}
        onSelectedSheetUpdated={onSelectedSheetUpdated}
        onCopyingStarted={(data) => { setCopyingData(data) }}
        onCopyingFinished={() => { setCopyingData(null) }}
        onSorting={onSorting}
      />
      break
    case 'line':
      view = <Graph type="line" sheet={sheet} />
      break
    case 'bar':
      view = <Graph type="bar" sheet={sheet} />
      break
    case 'pie':
      view = <Graph type="pie" sheet={sheet} />
      break
    default:
      throw new Error()
  }

  return (
    <>
      <CopyingModal isOpen={!!copyingData} cellCount={copyingData?.cellCount ?? 0} />
      <div className="sheet" tabIndex={-1}>
        {sheet.isLoading && (
          <div
            className="overlay"
            style={{
              display: sheet.isLoading ? 'block' : 'none'
            }}
          />
        )}
        <div className="inner">
          {view}
        </div>
      </div>
    </>
  )
}
