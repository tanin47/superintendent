import React, {ForwardedRef} from 'react';
import {Sheet} from './types';
import {Chart, ChartType, registerables} from 'chart.js';
import randomColor from 'randomcolor';
import {VariableSizeGrid as BaseGrid} from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

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
  cumulativeRowHeights: number[],
  computeRowHeight: (index: number) => number,
): React.ForwardRefExoticComponent<React.PropsWithoutRef<{}> & React.RefAttributes<HTMLDivElement>> {
  return React.useMemo(
    () =>
      React.forwardRef((props, ref: ForwardedRef<HTMLDivElement>) => {
        const shownIndices = getShownIndices(props.children);

        const children = React.Children.map(props.children, (child) => {
          const {row} = getCellIndicies(child);

          // do not show non-sticky cell
          if (row === 0) {
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

          const marginTop = i === 1 ? cumulativeRowHeights[rowIndex - 1] - headerRowHeight : undefined;

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
  columnWidths,
  width,
  height,
  initialScrollLeft,
  initialScrollTop,
  onScrolled,
  children
}: {
  rowCount: number,
  columnCount: number,
  computeRowHeight: (index: number) => number,
  columnWidths: number[],
  width: number,
  height: number,
  initialScrollLeft: number,
  initialScrollTop: number,
  onScrolled: (left: number, top: number) => void,
  children: any
},
  ref: any): JSX.Element {
  const computeColumnWidth = React.useCallback(
    (index: number) => {
      return columnWidths[index];
    },
    [columnWidths]
  );

  const baseGridRef = React.createRef<any>();

  React.useImperativeHandle(ref, () => ({
    update: (colIndex: number) => {
      if (baseGridRef.current) {
        baseGridRef.current.resetAfterColumnIndex(colIndex, true);
      }
    }
  }), [baseGridRef]);

  const cumulativeRowHeights: number[] = [rowCount >= 0 ? computeRowHeight(0) : 0];
  for (let i=1;i<rowCount;i++) {
    cumulativeRowHeights[i] = computeRowHeight(i) + cumulativeRowHeights[i - 1];
  }

  return (
    <BaseGrid
      ref={baseGridRef}
      rowCount={rowCount}
      rowHeight={computeRowHeight}
      columnCount={columnCount}
      columnWidth={computeColumnWidth}
      width={width}
      height={height}
      initialScrollLeft={initialScrollLeft}
      initialScrollTop={initialScrollTop}
      onScroll={({scrollLeft, scrollTop}) => onScrolled(scrollLeft, scrollTop)}
      innerElementType={useInnerElementType(
        children,
        columnWidths,
        cumulativeRowHeights,
        computeRowHeight,
      )}
    >
      {children}
    </BaseGrid>
  )
});

function Table({sheet}: {sheet: Sheet}): JSX.Element {
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
  const [mouseDownX, setMouseDownX] = React.useState<number>(0);
  const [mouseDownColWidth, setMouseDownColWidth] = React.useState<number>(0);
  const [resizingColIndex, setResizingColIndex] = React.useState<number | null>(null);
  const gridRef = React.createRef<any>();

  const resizeColMouseDownHandler = (colIndex: number) => (event: React.MouseEvent) => {
    if (!sheet.resizedColumns) {
      sheet.resizedColumns = {};
    }

    if (!sheet.resizedColumns[colIndex]) {
      sheet.resizedColumns[colIndex] = columnWidths[colIndex];
    }
    setMouseDownX(event.clientX);
    setMouseDownColWidth(sheet.resizedColumns[colIndex]);
    setResizingColIndex(colIndex);
  };

  React.useEffect(() => {
    const handler = (event) => {
      if (resizingColIndex === null) { return; }
      if (!gridRef.current) { return; }

      sheet.resizedColumns[resizingColIndex] = Math.max(event.clientX - mouseDownX + mouseDownColWidth, 20);
      columnWidths[resizingColIndex] = sheet.resizedColumns[resizingColIndex];
      gridRef.current.update(resizingColIndex);
    };
    document.addEventListener('mousemove', handler);

    return () => {
      document.removeEventListener('mousemove', handler) ;
    };
  }, [resizingColIndex, mouseDownColWidth, mouseDownX, gridRef]);

  React.useEffect(() => {
    const handler = (event) => {
      if (resizingColIndex === null) {
        return;
      }
      setResizingColIndex(null);
    };
    document.addEventListener('mouseup', handler);

    return () => {
      document.removeEventListener('mouseup', handler);
    }
  }, [resizingColIndex, setResizingColIndex]);

  const Cell = ({columnIndex, rowIndex, style}: {columnIndex: number, rowIndex: number, style: any}): JSX.Element => {
    if (rowIndex === 0) {
      return (
        <div
          key={`column-${columnIndex}`}
          style={{
            ...style,
            borderRight: '1px solid #ccc',
            borderBottom: 'thin solid #ccc',
            maxWidth: `${columnWidths[columnIndex]}px`,
            minWidth: `${columnWidths[columnIndex]}px`,
            paddingLeft: '4px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            fontWeight: 'bold',
            backgroundColor: '#eee',
            lineHeight: '20px',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textAlign: columnIndex === 0 ? 'center' : 'left',
            userSelect: resizingColIndex !== null ? 'none' : '',
          }}
        >
          {columnIndex > 0 && (
            <div
              className="resize-column-left-bar"
              onMouseDown={resizeColMouseDownHandler(columnIndex-1)}
            />
          )}
          {columnIndex === 0 ? '\u00A0' : sheet.columns[columnIndex-1].name}
          <div
            className="resize-column-right-bar"
            onMouseDown={resizeColMouseDownHandler(columnIndex)}
          />
        </div>
      );
    } else {
      return (
        <div
          key={`cell-${rowIndex}-${columnIndex}`}
          style={{
            ...style,
            borderRight: '1px solid #ccc',
            borderBottom: 'thin solid #ccc',
            maxWidth: `${columnWidths[columnIndex]}px`,
            minWidth: `${columnWidths[columnIndex]}px`,
            paddingLeft: '3px',
            paddingRight: '3px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: columnIndex === 0 ? '8px' : '12px',
            backgroundColor: columnIndex === 0 ? '#eee' : '',
            textAlign: columnIndex === 0 ? 'right' : 'left',
            lineHeight: '20px',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            userSelect: resizingColIndex !== null ? 'none' : '',
          }}
        >
          {columnIndex === 0 ? rowIndex : sheet.rows[rowIndex - 1][columnIndex - 1]}
        </div>
      );
    }
  };

  const computeRowHeight = React.useCallback(
    (index: number) => {
      return index === 0 ? getRowHeight(sheet.columns.map((c) => c.name)) : getRowHeight(sheet.rows[index - 1]);
    },
    [sheet]
  );

  return (
    <AutoSizer>
      {({height, width}) => {
        return (
          <Grid
            ref={gridRef}
            key={sheet.name}
            rowCount={sheet.rows.length + 1}
            computeRowHeight={computeRowHeight}
            columnCount={columnWidths.length}
            columnWidths={columnWidths}
            initialScrollLeft={sheet.scrollLeft || 0}
            initialScrollTop={sheet.scrollTop || 0}
            width={width}
            height={height}
            onScrolled={(left, top) => {
              sheet.scrollLeft = left;
              sheet.scrollTop = top;
            }}
          >
            {Cell}
          </Grid>
        );
      }}
    </AutoSizer>
  )
}

function Graph({type, sheet}: {type: ChartType, sheet: Sheet}): JSX.Element {
  const chartRef = React.createRef<any>();

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

export default function Sheet(props: {sheet: Sheet}): JSX.Element {

  React.useEffect(
    () => {
      Chart.register(...registerables);
    },
    []
  );

  let view: JSX.Element;

  switch (props.sheet.presentationType) {
    case 'table':
      view = <Table {...props} />;
      break;
    case 'line':
      view = <Graph type="line" {...props} />;
      break;
    case 'bar':
      view = <Graph type="bar" {...props} />;
      break;
    case 'pie':
      view = <Graph type="pie" {...props} />;
      break;
    default:
      throw new Error();
  }

  return (
    <div className="sheet">
      <div className="inner">
        {view}
      </div>
    </div>
  );
}
