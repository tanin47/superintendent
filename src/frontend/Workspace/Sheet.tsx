import React, {type ForwardedRef} from 'react'
import {type Column, type Result, type Selection, type UserSelectTarget} from './types'
import {VariableSizeGrid as BaseGrid} from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import InfiniteLoader from 'react-window-infinite-loader'
import {copy, loadMore, sort} from '../api'
import './Sheet.scss'
import {type SortDirection} from '../../types'
import CopyingModal from './CopyingModal'
import {makeCopy} from './helper'
import {shift, useClientPoint, useDismiss, useFloating, useInteractions, useTransitionStyles} from '@floating-ui/react'
import {type ChangingColumnInfo, ChangingColumnTypeDialog} from './ChangingColumnTypeDialog'
import {type ObjectWrapper, StateChangeApi, useDispatch} from './WorkspaceContext'
import Chart from './Chart'
import * as dialog from './dialog'

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

function getRowHeight (row: any[]): number {
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
): React.ForwardRefExoticComponent<React.PropsWithoutRef<unknown> & React.RefAttributes<HTMLDivElement>> {
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

function ColumnContextMenu ({
  column,
  onClosing,
  onChangingColumnType,
  x,
  y
}: {
  column: Column | null
  onClosing: () => void
  onChangingColumnType: () => void
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
    open: column !== null,
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

  if (!isMounted || !column) { return <></> }

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
          className="context-menu-header"
          data-testid="column-context-menu-column-type"
        >
          {column.tpe.toLocaleUpperCase()}
        </div>
        <div
          className="context-menu-item"
          onClick={() => {
            onChangingColumnType()
            onClosing()
          }}
          data-testid="column-context-menu-change-column-type"
        >
          Change column type
        </div>
      </div>
    </div>
  )
}

interface ColumnContextMenuOpenInfo {
  result: Result
  columnIndex: number
  clientX: number
  clientY: number
}

const DOUBLE_FORMATTER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 18 })

function Table ({
  result,
  onCopyingStarted,
  onCopyingFinished
}: {
  result: ObjectWrapper<Result>
  onCopyingStarted: (data: CopyingData) => void
  onCopyingFinished: () => void
}): JSX.Element {
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const _result = result.base

  const [columnContextMenuOpenInfo, setColumnContextMenuOpenInfo] = React.useState<ColumnContextMenuOpenInfo | null>(null)
  const [changingColumnInfo, setChangingColumnInfo] = React.useState<ChangingColumnInfo | null>(null)
  const [, setForceUpdate] = React.useState<number>(0)
  const columnWidths = React.useRef<number[]>([])

  React.useEffect(
    () => {
      columnWidths.current = [_result.resizedColumns?.[0] ? _result.resizedColumns[0] : MIN_CELL_WIDTH]

      _result.columns.forEach((column, index) => {
        if (_result.resizedColumns?.[index + 1]) {
          columnWidths.current.push(_result.resizedColumns[index + 1])
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
    [_result.columns, _result.resizedColumns]
  )

  const [userSelect, _setUserSelect] = React.useState<UserSelectTarget | null>(null)
  const setUserSelect = React.useCallback(
    (newUserSelect: UserSelectTarget | null) => {
      _setUserSelect(makeCopy(newUserSelect))
      _result.userSelect = makeCopy(newUserSelect)
    },
    [_result]
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
      _result.selection = makeCopy(newSelection)
    },
    [_result]
  )
  const [isSelecting, setIsSelecting] = React.useState<boolean>(false)

  React.useEffect(
    () => {
      _setSelection(_result.selection)
      _setUserSelect(_result.userSelect)
    },
    [_result, _setSelection, _setUserSelect]
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
    (rowIndex: number, colIndex: number) => () => {
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
      if (!_result.resizedColumns) {
        _result.resizedColumns = {}
      }

      if (!_result.resizedColumns[colIndex]) {
        _result.resizedColumns[colIndex] = columnWidths.current[colIndex]
      }
      mouseDownX.current = event.clientX
      mouseDownColWidth.current = _result.resizedColumns[colIndex]
      resizingColIndex.current = colIndex

      event.stopPropagation()
    },
    [_result]
  )

  React.useEffect(
    () => {
      const handler = (event: MouseEvent): void => {
        if (resizingColIndex.current === null) { return }
        if (!gridRef.current) { return }

        _result.resizedColumns[resizingColIndex.current] = Math.max(event.clientX - mouseDownX.current + mouseDownColWidth.current, MIN_CELL_WIDTH)
        columnWidths.current[resizingColIndex.current] = _result.resizedColumns[resizingColIndex.current]

        gridRef.current.updateColumn(resizingColIndex.current)
      }
      document.addEventListener('mousemove', handler)

      return () => {
        document.removeEventListener('mousemove', handler)
      }
    },
    [_result]
  )

  React.useEffect(() => {
    const handler = (): void => {
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

      endRow = endRow === 0 ? _result.count - 1 : endRow - 1
      endCol = endCol === 0 ? _result.columns.length - 1 : endCol - 1

      const copySelection = {
        columns: _result.columns.slice(startCol, endCol + 1).map((c) => c.name),
        startRow,
        endRow,
        includeRowNumbers,
        includeColumnNames
      }
      cellCount = (endRow - startRow + 1) * (endCol - startCol + 1)

      onCopyingStarted({ cellCount })
      void copy(_result.name, copySelection)
        .then(() => {
          setTimeout(
            () => { onCopyingFinished() },
            300
          )
        })
        .catch((e) => {
           
          void dialog.showError('Copying failed', e, { action: 'copying_failed' })
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
  }, [onCopyingFinished, onCopyingStarted, selection, result, userSelect, _result.count, _result.columns, _result.name])

  const isWithinRange = (value: number, start: number, end: number): boolean => {
    return (start <= value && value <= end) || (end <= value && value <= start)
  }

  const Cell = ({ columnIndex, rowIndex, style }: { columnIndex: number, rowIndex: number, style: any }): JSX.Element | null => {
    // There's a race condition between sheet and columnWidths because columnWidths is a ref.
    // There's a test that tests this bug.
    if ((columnIndex - 1) >= _result.columns.length) {
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

      if (_result.sorts && columnIndex > 0) {
        const columnName = _result.columns[columnIndex - 1].name
        direction = _result.sorts.find((s) => s.name === columnName)?.direction ?? 'none'

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
          onContextMenu={(event) => {
            if (columnIndex < 1) { return }

            setColumnContextMenuOpenInfo({
              result: _result,
              columnIndex: columnIndex - 1,
              clientX: event.clientX,
              clientY: event.clientY
            })
          }}
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
                  _result.sorts ||= []
                  const columnName = _result.columns[columnIndex - 1].name
                  let newDirection: SortDirection
                  if (direction === 'asc') {
                    newDirection = 'desc'
                  } else if (direction === 'desc') {
                    newDirection = 'none'
                  } else {
                    newDirection = 'asc'
                  }

                  stateChangeApi.startLoading(_result.id)

                  void sort(_result, columnName, newDirection)
                    .then((newResult) => {
                      stateChangeApi.addOrReplaceResult(newResult)
                    })
                    .catch((error) => {
                      void dialog.showError('Sorting failed', error as string, { action: 'sorting_failed' })
                    })
                    .finally(() => {
                      stateChangeApi.stopLoading(_result.id)
                    })

                  event.stopPropagation()
                }}
              ></i>
            </>
          )}
          {columnIndex === 0 ? '\u00A0' : _result.columns[columnIndex - 1].name}
          <div
            className="resize-column-right-bar"
            onMouseDown={resizeColMouseDownHandler(columnIndex)}
          />
        </div>
      )
    } else if (rowIndex === _result.rows.length + 1) {
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
      const value = columnIndex === 0 ? rowIndex : _result.rows[rowIndex - 1][columnIndex - 1]
      let nullStyles = {}
      let renderedValue = value

      if (value === null || value === undefined) {
        renderedValue = 'NULL'
        nullStyles = {
          fontStyle: 'italic',
          color: '#666',
          fontSize: '8px'
        }
      } else if (columnIndex >= 1) {
        const columnType = _result.columns[columnIndex - 1].tpe
        if (columnType === 'timestamp') {
          renderedValue = (value as Date).toISOString()
        } else if (columnType === 'double') {
          renderedValue = DOUBLE_FORMATTER.format(value as number)
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

  const gridRowCount = _result.rows.length + 1 + ((_result.rows.length < _result.count) ? 1 : 0)

  const computeRowHeight = React.useCallback(
    (index: number) => {
      if (index === 0) {
        return getRowHeight(_result.columns.map((c) => c.name))
      } else if (index === _result.rows.length + 1) {
        return 20
      } else {
        return getRowHeight(_result.rows[index - 1])
      }
    },
    [_result.columns, _result.rows]
  )

  const computeCumulativeRowHeight = React.useCallback(
    (index: number) => {
      if (index === 0) {
        return getRowHeight(_result.columns.map((c) => c.name))
      } else if (index === _result.rows.length + 1) {
        return 20 + computeCumulativeRowHeight(_result.rows.length)
      } else {
        const row = _result.rows[index - 1]
        if ((row as any).cumulativeHeight) {
          return (row as any).cumulativeHeight
        }

        let i = index
        let cumulativeHeight = computeRowHeight(i)
        i--

        for (;i >= 0; i--) {
          if (i > 0 && i < (_result.rows.length + 1)) {
            const thisRow = _result.rows[i - 1]

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
    [_result.rows, _result.columns, computeRowHeight]
  )

  const loadMoreItems = React.useCallback(
    async (): Promise<void> => {
      await loadMore(_result.name, _result.rows.length)
        .then((rows) => {
          const current = gridRef.current // setForceUpdate clears gridRef, so we need to save it first.
          const loadingRow = _result.rows.length
          _result.rows = _result.rows.concat(rows)
          setForceUpdate((n) => n + 1)
          stateChangeApi.addOrReplaceResult(_result)

          if (current) {
            current.updateRow(loadingRow) // update the height of the load more row.
          }
        })
    },
    [_result, stateChangeApi]
  )

  const isItemLoaded = React.useCallback(
    (index) => (index < (_result.rows.length + 1)),
    [_result.rows.length]
  )

  return (
    <>
      <ChangingColumnTypeDialog
        info={changingColumnInfo}
        // onChangingColumnType={() => {
        //   const current = gridRef.current
        //   setForceUpdate((x) => x + 1)

        //   if (current) {
        //     current.updateRow(0)
        //   }
        // }}
        onClosing={() => { setChangingColumnInfo(null) }}
      />
      <ColumnContextMenu
        column={columnContextMenuOpenInfo ? _result.columns[columnContextMenuOpenInfo.columnIndex] : null}
        x={columnContextMenuOpenInfo?.clientX ?? null}
        y={columnContextMenuOpenInfo?.clientY ?? null}
        onClosing={() => { setColumnContextMenuOpenInfo(null) }}
        onChangingColumnType={() => {
          const result = columnContextMenuOpenInfo!.result
          setChangingColumnInfo({
            result,
            column: _result.columns[columnContextMenuOpenInfo!.columnIndex]
          })
        }}
      />
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
                  key={_result.name}
                  rowCount={gridRowCount}
                  computeRowHeight={computeRowHeight}
                  computeCumulativeRowHeight={computeCumulativeRowHeight}
                  columnCount={columnWidths.current.length}
                  columnWidths={columnWidths.current}
                  initialScrollLeft={_result.scrollLeft ?? 0}
                  initialScrollTop={_result.scrollTop ?? 0}
                  width={width}
                  height={height}
                  onItemsRendered={onItemsRendered}
                  onScrolled={(left, top) => {
                    _result.scrollLeft = left
                    _result.scrollTop = top
                  }}
                >
                  {Cell}
                </Grid>
              )}
            </InfiniteLoader>
          )
        }}
      </AutoSizer>
    </>
  )
}

export default function SheetComponent ({
  result
}: {
  result: ObjectWrapper<Result>
}): JSX.Element {
  const [copyingData, setCopyingData] = React.useState<CopyingData | null>(null)

  const _result = result.base

  if (_result.columns.length === 0) {
    let msg = `Please run ${_result.name} in order to see the result.`

    if (_result.isCsv) {
      msg = `Please load the CSV into ${_result.name} in order to see the result.`
    }
    return <div className="sheet" tabIndex={-1}><div className="empty-warning">{msg}</div></div>
  }

  let view: JSX.Element = <></>

  switch (_result.presentationType) {
    case 'table':
      view = <Table
        result={result}
        onCopyingStarted={(data) => { setCopyingData(data) }}
        onCopyingFinished={() => { setCopyingData(null) }}
      />
      break
    case 'chart':
      view = <Chart result={result} />
      break
    default:
      throw new Error()
  }

  return (
    <>
      <CopyingModal isOpen={!!copyingData} cellCount={copyingData?.cellCount ?? 0} />
      <div className="sheet" tabIndex={-1}>
        {result.base.isLoading && (
          <div
            className="overlay"
            style={{
              display: result.base.isLoading ? 'block' : 'none'
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
