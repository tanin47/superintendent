import React from 'react';
import './app.scss';
import {query} from '../api';
import {ipcRenderer} from 'electron';

export default function App(): JSX.Element {
  const [data, setData] = React.useState<{columns: Array<string>, rows: Array<{[key:string]: any}>} | null>(null);
  const [queryString, setQueryString] = React.useState('SELECT * FROM test_csv LIMIT 1');

  ipcRenderer.on('result', (event, arg) => {
    setData(arg);
  });

  return (
    <div className="app">
      {!data && (<h1>Please load a CSV file.</h1>)}
      {data &&
      <>
        <h1>Write a query!</h1>
        <p>
          <textarea value={queryString} onChange={(e) => setQueryString(e.target.value)} />
          <br/>
          <button
            onClick={() => query(queryString)}
          >Click me</button>
        </p>
        <p>
          <table>
            <thead>
            <tr>
              {data.columns.map((col) => {
                return (
                  <th>{col}</th>
                );
              })}
            </tr>
            </thead>
            <tbody>
            {data.rows.map((row) => {
              return (
                <tr>
                  {data.columns.map((col) => {
                    return (
                      <td>{row[col]}</td>
                    );
                  })}
                </tr>
              );
            })}
            </tbody>
          </table>
        </p>
      </>
      }
    </div>
  );
}
