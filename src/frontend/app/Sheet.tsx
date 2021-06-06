import React from 'react';
import {Sheet} from "./types";

export default function Sheet({sheet}: {sheet: Sheet}): JSX.Element {
  return (
    <div className="sheet">
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
      </table>
      {sheet.hasMore && <div className="has-more">There are {sheet.count} rows, but only {sheet.rows.length} rows is shown. Please export the sheet to see all the rows.</div>}
    </div>
  );
}
