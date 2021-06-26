import React from 'react';
import {Sheet} from './types';
import {shell} from 'electron';
import {Chart, ChartType, registerables} from 'chart.js';

function Table({evaluationMode, sheet}: {evaluationMode: boolean, sheet: Sheet}): JSX.Element {
  const hasMore = sheet.rows.length < sheet.count;
  let totalLabel: JSX.Element | null = null;

  if (sheet.count > 1) {
    if (hasMore) {
      totalLabel = (
        <tr>
          <td colSpan={sheet.columns.length} className="has-more">There are {sheet.count.toLocaleString('en-US')} rows, but only {sheet.rows.length.toLocaleString('en-US')} rows is shown. Please export the sheet to see all the rows.</td>
        </tr>
      );
    } else {
      totalLabel = (
        <tr>
          <td colSpan={sheet.columns.length} className="has-more">There are {sheet.count.toLocaleString('en-US')} rows.</td>
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
            {sheet.columns.map((col, index) => {
              return (
                <td key={`col-${index}`}>{row[col]}</td>
              );
            })}
          </tr>
        );
      })}
      </tbody>
        <tfoot>
          {totalLabel}
          {evaluationMode && (
            <tr>
              <td colSpan={sheet.columns.length} className="has-more">In the evaluation mode, you can load up to 100 rows per CSV. Please <span className="link" onClick={() => shell.openExternal("https://superintendent.app/buy")}>get a license</span> in order to get full access.</td>
            </tr>
          )}
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

      if (type === 'pie') {
        colorOptionsMap = {backgroundColor: sheet.rows.map(() => generateColor())};
      } else {
        colorOptionsMap = {
          borderColor: '#C71585',
          backgroundColor: sheet.rows.map(() => '#C71585'),
        }
      }

      const instance = new Chart(ctx, {
        type: type,
        data: {
          labels: sheet.rows.map((r) => r[sheet.columns[0]]),
          datasets: [{
            label: sheet.columns[1],
            data: sheet.rows.map((r) => parseFloat(r[sheet.columns[1]])),
            ...colorOptionsMap
          }]
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
