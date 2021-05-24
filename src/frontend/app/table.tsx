import React from 'react';

export default function Table({data}: {data: {columns: Array<string>, rows: Array<{[key:string]: any}>}}): JSX.Element {
  return (
    <div style={{padding: '10px'}}>
      <table>
        <thead>
        <tr>
          {data.columns.map((col, index) => {
            return (
              <th key={index}>{col}</th>
            );
          })}
        </tr>
        </thead>
        <tbody>
        {data.rows.map((row, index) => {
          return (
            <tr key={`row-${index}`}>
              {data.columns.map((col, index) => {
                return (
                  <td key={`col-${index}`}>{row[col]}</td>
                );
              })}
            </tr>
          );
        })}
        </tbody>
      </table>
    </div>
  );
}
