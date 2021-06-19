import React from 'react';
import {Sheet} from './types';
import {shell} from 'electron';
import Chart from 'chart.js';

function Table({evaluationMode, sheet}: {evaluationMode: boolean, sheet: Sheet}): JSX.Element {
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
      {sheet.hasMore && (
        <tr>
          <td colSpan={sheet.columns.length} className="has-more">There are {sheet.count} rows, but only {sheet.rows.length} rows is shown. Please export the sheet to see all the rows.</td>
        </tr>
      )}
      {evaluationMode && (
        <tr>
          <td colSpan={sheet.columns.length} className="has-more">In the evaluation mode, you can load up to 100 rows per CSV. Please <span className="link" onClick={() => shell.openExternal("https://superintendent.app/buy")}>get a license</span> in order to get full access.</td>
        </tr>
      )}
      </tbody>
    </table>
  )
}

function Line({evaluationMode, sheet}: {evaluationMode: boolean, sheet: Sheet}): JSX.Element {
  const chartRef = React.createRef<any>();

  React.useEffect(
    () => {
      const ctx = chartRef.current?.getContext("2d");

      if (!ctx) { return; }

      new Chart(ctx, {
        type: 'line',
        data: {
          labels: sheet.rows.map((r) => r[0]),
          data: sheet.rows.map((r) => r[1]),
        }
      });
    },
    [sheet, chartRef]
  )


  return (
    <canvas ref={chartRef} />
  );
}

export default function Sheet(props: {evaluationMode: boolean, sheet: Sheet}): JSX.Element {

  let view: JSX.Element;

  switch (props.sheet.presentationType) {
    case 'table':
      view = <Table {...props} />;
      break;
    case 'line':
      view = <Table {...props} />;
      break;
    case 'bar':
      view = <Table {...props} />;
      break;
    case 'pie':
      view = <Table {...props} />;
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
