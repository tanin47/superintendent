import React from 'react';
import './app.scss';
import {query} from '../api';
import {ipcRenderer} from 'electron';
import Table from './table';

export default function App(): JSX.Element {
  const [csvData, setCsvData] = React.useState<{columns: Array<string>, rows: Array<{[key:string]: any}>} | null>(null);
  const [queryString, setQueryString] = React.useState('SELECT * FROM test_csv LIMIT 1');
  const [queryResult, setQueryResult] = React.useState<{columns: Array<string>, rows: Array<{[key:string]: any}>} | null>(null);

  ipcRenderer.on('load-table-result', (event, arg) => {
    setCsvData(arg);
  });

  ipcRenderer.on('query-result', (event, arg) => {
    setQueryResult(arg);
  });

  return (
    <div className="app">
      {!csvData && (<h1>Please load a CSV file.</h1>)}
      {csvData &&
      <>
        <h1>Write a query!</h1>
        <p>
          <textarea value={queryString} onChange={(e) => setQueryString(e.target.value)} />
          <br/>
          <button
            onClick={() => query(queryString)}
          >Click me</button>
        </p>
        {queryResult && <Table data={queryResult} />}
        <Table data={csvData} />
      </>
      }
    </div>
  );
}
