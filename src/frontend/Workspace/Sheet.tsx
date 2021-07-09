import React from 'react';
import {Sheet} from './types';
import {Chart, ChartType, registerables} from 'chart.js';

function Table({evaluationMode, sheet}: {evaluationMode: boolean, sheet: Sheet}): JSX.Element {
  const hasMore = sheet.rows.length < sheet.count;
  let totalLabel: JSX.Element | null = null;

  if (sheet.count > 1) {
    if (hasMore) {
      totalLabel = (
        <tr>
          <td colSpan={sheet.columns.length} className="has-more">Only {sheet.rows.length.toLocaleString('en-US')} rows are previewed. Please export the sheet to see all the rows.</td>
        </tr>
      );
    }
  }

  return (
    <table cellPadding={0} cellSpacing={0}>
      <thead>
      <tr>
        {sheet.columns.map((col, index) => {
          return (
            <th key={index}>{col}</th>
          );
        })}
      </tr>
      </thead>
      <tbody>
      {sheet.rows.map((row, index) => {
        return (
          <tr key={`row-${index}`}>
            {row.map((row, index) => {
              return (
                <td key={`col-${index}`}>{row}</td>
              );
            })}
          </tr>
        );
      })}
      </tbody>
      <tfoot>
        {totalLabel}
      </tfoot>
    </table>
  )
}

function generateColor() {
  var r = Math.floor(Math.random() * 255);
  var g = Math.floor(Math.random() * 255);
  var b = Math.floor(Math.random() * 255);
  return "rgb(" + r + "," + g + "," + b + ")";
}

function Graph({type, sheet}: {type: ChartType, sheet: Sheet}): JSX.Element {
  const chartRef = React.createRef<any>();

  React.useEffect(
    () => {
      const ctx = chartRef.current?.getContext("2d");

      if (!ctx) { return; }

      let colorOptionsMap: {backgroundColor?: string[], borderColor?: string} = {};


      const instance = new Chart(ctx, {
        type: type,
        data: {
          labels: sheet.rows.map((r) => r[0]),
          datasets: sheet.columns.slice(1).map((column, index) => {
            if (type === 'pie') {
              colorOptionsMap = {backgroundColor: sheet.rows.map(() => generateColor())};
            } else {
              const color = generateColor();
              colorOptionsMap = {
                borderColor: color,
                backgroundColor: sheet.rows.map(() => color),
              }
            }
            return {
              label: column,
              data: sheet.rows.map((r) => parseFloat(r[index + 1])),
              ...colorOptionsMap
            };
          })
        },
        options: {
          maintainAspectRatio: false,
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

export default function Sheet(props: {evaluationMode: boolean, sheet: Sheet}): JSX.Element {

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
