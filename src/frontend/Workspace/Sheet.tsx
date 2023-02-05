import React, {ForwardedRef} from 'react';
import {Sheet, Selection, UserSelectTarget, PresentationType} from './types';
import {Chart, ChartType, registerables} from 'chart.js';
import randomColor from 'randomcolor';
// @ts-ignore
import {VariableSizeGrid as BaseGrid} from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import InfiniteLoader from 'react-window-infinite-loader';
import {loadMore, copy} from "../api";
import './Sheet.scss';
import {CopySelection} from "../../types";
import CopyingModal from "./CopyingModal";
import {isChartEnabled, makeCopy} from "./helper";

type CopyingData = {
  cellCount: number
};

let canvas: HTMLCanvasElement = document.createElement("canvas");

function getTextWidth(text: string, font: string): number {
  const context = canvas.getContext("2d")!;
  context.font = font;
  const metrics = context.measureText(text);
  return Math.ceil(metrics.width) + 8; // for padding
}

function getRowHeight(row: string[]): number {
  if ((row as any).height) {
    return (row as any).height;
  }
  const context = canvas.getContext("2d")!;
  context.font = '12px JetBrains Mono';

  let height = 20;
  row.forEach((value) => {
    height = Math.max(height, `${value}`.split('\n').length * 20);
  });

  (row as any).height = Math.ceil(height) + 1;
  return (row as any).height;
}

function getCellIndicies(child) {
  return {row: child.props.rowIndex, column: child.props.columnIndex};
}

function getShownIndices(children) {
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minColumn = Infinity;
  let maxColumn = -Infinity;

  React.Children.forEach(children, (child) => {
    const { row, column } = getCellIndicies(child);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minColumn = Math.min(minColumn, column);
    maxColumn = Math.max(maxColumn, column);
  });

  return {
    from: {
      row: minRow,
      column: minColumn
    },
    to: {
      row: maxRow,
      column: maxColumn
    }
  };
}


function useInnerElementType(
  cell: any,
  columnWidths: number[],
  computeRowHeight: (index: number) => number,
  computeCumulativeRowHeight: (index: number) => number,
): React.ForwardRefExoticComponent<React.PropsWithoutRef<{}> & React.RefAttributes<HTMLDivElement>> {
  return React.useMemo(
    () =>
      React.forwardRef((props, ref: ForwardedRef<HTMLDivElement>) => {
        const shownIndices = getShownIndices(props.children);

        const children = React.Children.map(props.children, (child) => {
          const {row, column} = getCellIndicies(child);

          // do not show non-sticky cell
          if (row === 0 || column === 0) {
            return null;
          }

          return child;
        })!;

        const cumulativeColumnWidths: number[] = [columnWidths[0]];
        for (let i=1;i<columnWidths.length;i++) {
          cumulativeColumnWidths[i] = columnWidths[i] + cumulativeColumnWidths[i - 1];
        }

        children.push(
          React.createElement(cell, {
            key: "0:0",
            rowIndex: 0,
            columnIndex: 0,
            style: {
              display: "inline-flex",
              width: columnWidths[0],
              height: computeRowHeight(0),
              position: "sticky",
              top: 0,
              left: 0,
              zIndex: 4
            }
          })
        );

        const shownColumnsCount = shownIndices.to.column - shownIndices.from.column;

        for (let i = 1; i <= shownColumnsCount; i += 1) {
          const columnIndex = i + shownIndices.from.column;
          const rowIndex = 0;
          const width = columnWidths[columnIndex];
          const height = computeRowHeight(rowIndex);

          const marginLeft = i === 1 ? cumulativeColumnWidths[columnIndex - 1] - columnWidths[0] : undefined;

          children.push(
            React.createElement(cell, {
              key: `${rowIndex}:${columnIndex}`,
              rowIndex,
              columnIndex,
              style: {
                marginLeft,
                display: "inline-flex",
                width,
                height,
                position: "sticky",
                top: 0,
                zIndex: 3
              }
            })
          );
        }

        const shownRowsCount = shownIndices.to.row - shownIndices.from.row;
        const headerRowHeight = computeRowHeight(0);

        for (let i = 1; i <= shownRowsCount; i += 1) {
          const columnIndex = 0;
          const rowIndex = i + shownIndices.from.row;
          const width = columnWidths[columnIndex];
          const height = computeRowHeight(rowIndex);

          const marginTop = i === 1 ? computeCumulativeRowHeight(rowIndex - 1) - headerRowHeight : undefined;

          children.push(
            React.createElement(cell, {
              key: `${rowIndex}:${columnIndex}`,
              rowIndex,
              columnIndex,
              style: {
                marginTop,
                width,
                height,
                position: "sticky",
                left: 0,
                zIndex: 2
              }
            })
          );
        }

        return (
          <div ref={ref} {...props}>
            {children}
          </div>
        );
      }),
    [cell, columnWidths, computeRowHeight]
  );
}

const Grid = React.forwardRef(function Grid({
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
  rowCount: number,
  columnCount: number,
  computeRowHeight: (index: number) => number,
  computeCumulativeRowHeight: (index: number) => number,
  columnWidths: number[],
  width: number,
  height: number,
  initialScrollLeft: number,
  initialScrollTop: number,
  onScrolled: (left: number, top: number) => void,
  onItemsRendered: (params: any) => void,
  infiniteLoaderRef: (r: any) => void,
  children: any
},
  ref: any): JSX.Element {
  const computeColumnWidth = React.useCallback(
    (index: number) => {
      return columnWidths[index];
    },
    [columnWidths]
  );

  const baseGridRef = React.useRef<any>();

  React.useImperativeHandle(ref, () => ({
    updateColumn: (colIndex: number) => {
      if (baseGridRef.current) {
        baseGridRef.current.resetAfterColumnIndex(colIndex, true);
      }
    },
    updateRow: (rowIndex: number) => {
      if (baseGridRef.current) {
        baseGridRef.current.resetAfterRowIndex(rowIndex, true);
      }
    }
  }), [baseGridRef]);

  return (
    <BaseGrid
      ref={(r) => {
        baseGridRef.current = r;
        infiniteLoaderRef(r)
      }}
      rowCount={rowCount}
      rowHeight={computeRowHeight}
      columnCount={columnCount}
      columnWidth={computeColumnWidth}
      width={width}
      height={height}
      initialScrollLeft={initialScrollLeft}
      initialScrollTop={initialScrollTop}
      onScroll={({scrollLeft, scrollTop}) => onScrolled(scrollLeft, scrollTop)}
      onItemsRendered={({
        visibleRowStartIndex,
        visibleRowStopIndex,
        overscanRowStopIndex,
        overscanRowStartIndex,
      }) => {
        onItemsRendered({
          overscanStartIndex: overscanRowStartIndex,
          overscanStopIndex: overscanRowStopIndex,
          visibleStartIndex: visibleRowStartIndex,
          visibleStopIndex: visibleRowStopIndex,
        });
      }}
      innerElementType={useInnerElementType(
        children,
        columnWidths,
        computeRowHeight,
        computeCumulativeRowHeight,
      )}
    >
      {children}
    </BaseGrid>
  )
});

function Table({
  sheet,
  onSelectedSheetUpdated,
  onCopyingStarted,
  onCopyingFinished
}: {
  sheet: Sheet,
  onSelectedSheetUpdated: (sheet: Sheet | null) => void,
  onCopyingStarted: (data: CopyingData) => void,
  onCopyingFinished: () => void
}): JSX.Element {
  const [forceUpdate, setForceUpdate] = React.useState<number>(0);
  const columnWidths = [sheet.resizedColumns && sheet.resizedColumns[0] ? sheet.resizedColumns[0] : 30];
  sheet.columns.forEach((column, index) => {
    if (sheet.resizedColumns && sheet.resizedColumns[index + 1]) {
      columnWidths.push(sheet.resizedColumns[index + 1]);
      return;
    }

    const width = 1 + Math.max(
      getTextWidth(column.name, 'bold 12px JetBrains Mono'),
      getTextWidth('#'.repeat(column.maxCharWidthCount), '12px JetBrains Mono'),
      20
    );

    columnWidths.push(width);
  });

  const [userSelect, _setUserSelect] = React.useState<UserSelectTarget | null>(null);
  const setUserSelect = (newUserSelect: UserSelectTarget | null) => {
    _setUserSelect(makeCopy(newUserSelect));
    sheet.userSelect = makeCopy(newUserSelect);
  };
  const doubleClickHandler = React.useCallback(
    (rowIndex: number, colIndex: number) => (event: React.MouseEvent) => {
      if (event.detail < 2) return; // not a double click.
      if (userSelect && userSelect.rowIndex === rowIndex && userSelect.colIndex === colIndex) return; // selecting text the cell.
      setUserSelect({rowIndex, colIndex});
    },
    [setUserSelect, userSelect]
  );

  const [selection, _setSelection] = React.useState<Selection | null>(null);
  const setSelection = (newSelection: Selection | null) => {
    _setSelection(makeCopy(newSelection));
    sheet.selection = makeCopy(newSelection);
  };
  const [isSelecting, setIsSelecting] = React.useState<boolean>(false);

  React.useEffect(
    () => {
      _setSelection(sheet.selection);
      _setUserSelect(sheet.userSelect);
    },
    [sheet, _setSelection, _setUserSelect]
  );

  const startSelection = React.useCallback(
    (rowIndex: number, colIndex: number) => (event: React.MouseEvent) => {
      if (event.button !== 0) return; // not a left click
      if (event.detail >= 2) return; // A double click is for selecting the text.
      if (userSelect && userSelect.rowIndex === rowIndex && userSelect.colIndex === colIndex) return; // selecting text the cell.
      setIsSelecting(true);
      const newSelection = {
        startRow: rowIndex,
        endRow: rowIndex,
        startCol: colIndex,
        endCol: colIndex,
      };
      setSelection(newSelection);
      setUserSelect(null);
    },
      [setIsSelecting, setSelection, setUserSelect, userSelect]
  );

  const addSelection = React.useCallback(
    (rowIndex: number, colIndex: number) => (event: React.MouseEvent) => {
      if (!isSelecting) return;
      if (selection === null) return;

      const newSelection = {
        startRow: selection.startRow,
        endRow: rowIndex,
        startCol: selection.startCol,
        endCol: colIndex,
      };

      setSelection(newSelection);
    },
    [setSelection, selection, isSelecting]
  );

  const [mouseDownX, setMouseDownX] = React.useState<number>(0);
  const [mouseDownColWidth, setMouseDownColWidth] = React.useState<number>(0);
  const [resizingColIndex, setResizingColIndex] = React.useState<number | null>(null);
  const gridRef = React.useRef<any>(null);

  React.useEffect(
    () => {
      if (gridRef.current) {
        gridRef.current.updateColumn(0);
      }
    },
    [sheet]
  );

  const resizeColMouseDownHandler = React.useCallback(
    (colIndex: number) => (event: React.MouseEvent) => {
      if (!sheet.resizedColumns) {
        sheet.resizedColumns = {};
      }

      if (!sheet.resizedColumns[colIndex]) {
        sheet.resizedColumns[colIndex] = columnWidths[colIndex];
      }
      setMouseDownX(event.clientX);
      setMouseDownColWidth(sheet.resizedColumns[colIndex]);
      setResizingColIndex(colIndex);

      event.stopPropagation();
    },
    [setMouseDownX, setMouseDownColWidth, setResizingColIndex, sheet]
  );

  React.useEffect(() => {
    const handler = (event) => {
      if (resizingColIndex === null) { return; }
      if (!gridRef.current) { return; }

      sheet.resizedColumns[resizingColIndex] = Math.max(event.clientX - mouseDownX + mouseDownColWidth, 20);
      columnWidths[resizingColIndex] = sheet.resizedColumns[resizingColIndex];

      gridRef.current.updateColumn(resizingColIndex);
    };
    document.addEventListener('mousemove', handler);

    return () => {
      document.removeEventListener('mousemove', handler) ;
    };
  }, [resizingColIndex, mouseDownColWidth, mouseDownX, gridRef, sheet]);

  React.useEffect(() => {
    const handler = (event) => {
      if (resizingColIndex !== null) {
        setResizingColIndex(null);
      }

      if (isSelecting) {
        setIsSelecting(false);
      }
    };
    document.addEventListener('mouseup', handler);

    return () => {
      document.removeEventListener('mouseup', handler);
    }
  }, [resizingColIndex, setResizingColIndex, isSelecting, setIsSelecting]);

  React.useEffect(() => {
    const handler = async (event): Promise<void> => {
      if (userSelect !== null) return; // selecting text instead
      if (event.target.tagName.toLocaleLowerCase() === 'textarea') return; // The target is a text area. We skip this custom copy logic.
      if (selection === null) return;

      let copySelection: CopySelection;
      let cellCount = 0;

      let startRow = Math.min(selection.startRow, selection.endRow);
      let endRow = Math.max(selection.startRow, selection.endRow);
      let startCol = Math.min(selection.startCol, selection.endCol);
      let endCol = Math.max(selection.startCol, selection.endCol);
      let includeColumnNames = false;
      let includeRowNumbers = false;

      if (startRow === 0) {
        includeColumnNames = true;
      } else {
        startRow--;
      }

      if (startCol === 0) {
        includeRowNumbers = true;
      } else {
        startCol--;
      }

      endRow = endRow === 0 ? sheet.count - 1 : endRow - 1;
      endCol = endCol === 0 ? sheet.columns.length - 1 : endCol - 1;

      copySelection = {
        columns: sheet.columns.slice(startCol, endCol + 1).map((c, i) => c.name),
        startRow,
        endRow,
        includeRowNumbers,
        includeColumnNames
      };
      cellCount = (endRow - startRow + 1) * (endCol - startCol + 1);

      onCopyingStarted({cellCount})
      copy(sheet.name, copySelection)
        .then((result) => {
          setTimeout(
            () => onCopyingFinished(),
            300
          );
        })
        .catch((e) => {
          console.log(e);
          alert("Error while copying.");
          onCopyingFinished();
        });

      event.stopPropagation();
      event.preventDefault();
    };

    document.addEventListener('copy', handler);
    document.addEventListener('cut', handler);

    return () => {
      document.removeEventListener('copy', handler);
      document.removeEventListener('cut', handler);
    }
  }, [selection, userSelect]);

  const isWithinRange = (value: number, start: number, end: number): boolean => {
    return (start <= value && value <= end) || (end <= value && value <= start);
  };

  const Cell = ({columnIndex, rowIndex, style}: {columnIndex: number, rowIndex: number, style: any}): JSX.Element => {
    let backgroundColor = '';

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
        backgroundColor = '#77dd77';
      } else {
        backgroundColor = '#DAF7A6';
      }
    } else {
      if (columnIndex === 0 || rowIndex === 0) { // the row number column
        backgroundColor = '#eee';
      }
    }

    let userSelectStyle: {[key: string]: string} = {userSelect: 'none'};
    if (!!userSelect && userSelect.rowIndex === rowIndex && userSelect.colIndex === columnIndex) {
      userSelectStyle = {
        userSelect: 'text',
        borderColor: '#80bdff',
        outline: '0',
        boxShadow: '0 0 0 .2rem rgba(0, 123, 255, .25)',
        cursor: 'text',
        zIndex: '1000',
      };
    }


    if (rowIndex === 0) {
      return (
        <div
          key={`column-${columnIndex}`}
          className="cell"
          style={{
            borderRight: '1px solid #ccc',
            borderBottom: 'thin solid #ccc',
            maxWidth: `${columnWidths[columnIndex]}px`,
            minWidth: `${columnWidths[columnIndex]}px`,
            paddingLeft: '4px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            fontWeight: 'bold',
            backgroundColor,
            lineHeight: '20px',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            userSelect: 'none',
            textAlign: columnIndex === 0 ? 'center' : 'left',
            ...style,
          }}
          onCopy={() => {}}
          onMouseDown={startSelection(rowIndex, columnIndex)}
          onMouseEnter={addSelection(rowIndex, columnIndex)}
        >
          {columnIndex > 0 && (
            <div
              className="resize-column-left-bar"
              onMouseDown={resizeColMouseDownHandler(columnIndex - 1)}

            />
          )}
          {columnIndex === 0 ? '\u00A0' : sheet.columns[columnIndex - 1].name}
          <div
            className="resize-column-right-bar"
            onMouseDown={resizeColMouseDownHandler(columnIndex)}
          />
        </div>
      );
    } else if (rowIndex === sheet.rows.length + 1) {
      return (
        <div
          key={`loading-next-${columnIndex}`}
          style={{
            maxWidth: `${columnWidths[columnIndex]}px`,
            minWidth: `${columnWidths[columnIndex]}px`,
            paddingLeft: '4px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            fontWeight: 'bold',
            backgroundColor: '#ccc',
            lineHeight: '20px',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            userSelect: 'none',
            ...style,
          }}
        >
          &nbsp;
        </div>
      );
    } else {
      const value = columnIndex === 0 ? rowIndex : sheet.rows[rowIndex - 1][columnIndex - 1];
      let nullStyles = {};
      let renderedValue = value;

      if (value === null || value === undefined) {
        renderedValue = "NULL";
        nullStyles = {
          fontStyle: 'italic',
          color: '#666',
          fontSize: '8px'
        };
      }

      return (
        <div
          key={`cell-${rowIndex}-${columnIndex}`}
          className="cell"
          style={{
            borderRight: '1px solid #ccc',
            borderBottom: 'thin solid #ccc',
            maxWidth: `${columnWidths[columnIndex]}px`,
            minWidth: `${columnWidths[columnIndex]}px`,
            paddingLeft: '3px',
            paddingRight: '3px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: columnIndex === 0 ? '8px' : '12px',
            backgroundColor,
            textAlign: columnIndex === 0 ? 'right' : 'left',
            lineHeight: '20px',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            ...userSelectStyle,
            ...style,
            ...nullStyles
          }}
          onMouseDown={startSelection(rowIndex, columnIndex)}
          onMouseEnter={addSelection(rowIndex, columnIndex)}
          onClick={doubleClickHandler(rowIndex, columnIndex)}
        >
          {renderedValue}
        </div>
      );
    }
  };

  const gridRowCount = sheet.rows.length + 1 + ((sheet.rows.length < sheet.count) ? 1 : 0);

  const computeRowHeight = React.useCallback(
    (index: number) => {
      if (index === 0) {
        return getRowHeight(sheet.columns.map((c) => c.name));
      } else if (index === sheet.rows.length + 1) {
        return 20;
      } else {
        return getRowHeight(sheet.rows[index - 1]);
      }
    },
    [sheet]
  );

  const computeCumulativeRowHeight = React.useCallback(
    (index: number) => {
      if (index === 0) {
        return getRowHeight(sheet.columns.map((c) => c.name));
      } else if (index === sheet.rows.length + 1) {
        return 20 + computeCumulativeRowHeight(sheet.rows.length);
      } else {
        const row = sheet.rows[index - 1];
        if ((row as any).cumulativeHeight) {
          return (row as any).cumulativeHeight;
        }

        let i = index;
        let cumulativeHeight = computeRowHeight(i);
        i--;

        for (;i>=0;i--) {
          if (i > 0 && i < (sheet.rows.length + 1)) {
            const thisRow = sheet.rows[i-1];

            if ((thisRow as any).cumulativeHeight) {
              cumulativeHeight += (thisRow as any).cumulativeHeight;
              break;
            }
          }
          cumulativeHeight += computeRowHeight(i);
        }

        (row as any).cumulativeHeight = cumulativeHeight;
        return (row as any).cumulativeHeight;
      }
    },
    [sheet, computeRowHeight]
  );

  const loadMoreItems = React.useCallback(
    (startIndex: number, stopIndex: number): Promise<void> => {
      return loadMore(sheet.name, sheet.rows.length)
        .then((rows) => {
          const current = gridRef.current; // setForceUpdate clears gridRef, so we need to save it first.
          const loadingRow = sheet.rows.length;
          sheet.rows = sheet.rows.concat(rows);
          setForceUpdate((n) => n+1);
          onSelectedSheetUpdated(sheet);

          if (current) {
            current.updateRow(loadingRow); // update the height of the load more row.
          }
        });
    },
    [sheet, gridRef]
  );

  const isItemLoaded = React.useCallback(
    (index) => (index < (sheet.rows.length + 1)),
    [sheet]
  )

  return (
    <AutoSizer>
      {({height, width}) => {
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
                columnCount={columnWidths.length}
                columnWidths={columnWidths}
                initialScrollLeft={sheet.scrollLeft || 0}
                initialScrollTop={sheet.scrollTop || 0}
                width={width}
                height={height}
                onItemsRendered={onItemsRendered}
                onScrolled={(left, top) => {
                  sheet.scrollLeft = left;
                  sheet.scrollTop = top;
                }}
              >
                {Cell}
              </Grid>
            )}
          </InfiniteLoader>
        );
      }}
    </AutoSizer>
  )
}

function Graph({type, sheet}: {type: ChartType, sheet: Sheet}): JSX.Element {
  const chartRef = React.useRef<any>(null);

  React.useEffect(
    () => {
      const ctx = chartRef.current?.getContext("2d");

      if (!ctx) { return; }

      let colorOptionsMap: {backgroundColor?: string[], borderColor?: string} = {};

      let colors = randomColor({
        count: sheet.columns.length,
        seed: 42
      });

      const instance = new Chart(ctx, {
        type: type,
        data: {
          labels: sheet.rows.map((r) => r[0]),
          datasets: sheet.columns.slice(1).map((column, index) => {
            if (type === 'pie') {
              colors = randomColor({
                count: sheet.rows.length,
                seed: 42
              });
              colorOptionsMap = {backgroundColor: sheet.rows.map((r, rowIndex) => colors[rowIndex])};
            } else {
              colorOptionsMap = {
                borderColor: colors[index],
                backgroundColor: sheet.rows.map(() => colors[index]),
              }
            }
            return {
              label: column.name,
              data: sheet.rows.map((r) => parseFloat(r[index + 1])),
              ...colorOptionsMap
            };
          })
        },
        options: {
          maintainAspectRatio: false,
          normalized: true
        }
      });

      return () => {
        instance.destroy();
      }
    },
    [sheet, type]
  )


  return (
    <canvas ref={chartRef} />
  );
}

export default function Sheet({
  sheet,
  presentationType,
  onSelectedSheetUpdated
}: {
  sheet: Sheet,
  presentationType: PresentationType,
  onSelectedSheetUpdated: (sheet: Sheet | null) => void
}): JSX.Element {

  if (sheet.columns.length === 0) {
    let msg = `Please run ${sheet.name} in order to see the result.`;

    if (sheet.isCsv) {
      msg = `Please load the CSV into ${sheet.name} in order to see the result.`;
    }
    return <div className="sheet" tabIndex={-1}><div className="empty-warning">{msg}</div></div>;
  }

  React.useEffect(
    () => {
      Chart.register(...registerables);
    },
    []
  );

  let view: JSX.Element;

  const [copyingData, setCopyingData] = React.useState<CopyingData | null>(null);

  let updatedPresentationType = presentationType;

  if (!isChartEnabled(sheet.rows.length)) { updatedPresentationType = 'table'; }

  switch (updatedPresentationType) {
    case 'table':
      view = <Table sheet={sheet} onSelectedSheetUpdated={onSelectedSheetUpdated} onCopyingStarted={(data) => setCopyingData(data)} onCopyingFinished={() => setCopyingData(null)} />;
      break;
    case 'line':
      view = <Graph type="line" sheet={sheet} />;
      break;
    case 'bar':
      view = <Graph type="bar" sheet={sheet} />;
      break;
    case 'pie':
      view = <Graph type="pie" sheet={sheet} />;
      break;
    default:
      throw new Error();
  }

  return (
    <>
      <CopyingModal isOpen={!!copyingData} cellCount={copyingData?.cellCount || 0} />
      <div className="sheet" tabIndex={-1}>
        <div className="inner">
          {view}
        </div>
      </div>
    </>
  );
}
