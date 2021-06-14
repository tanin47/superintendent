import React from 'react';
import {Sheet} from "./types";
import {shell} from "electron";

export default function Sheet({evaluationMode, sheet}: {evaluationMode: boolean, sheet: Sheet}): JSX.Element {
  return (
    <div className="sheet">
      <div className="inner">
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
      </div>
    </div>
  );
}
