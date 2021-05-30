import React, { ReactElement } from 'react';
import './app.scss';
import { ipcRenderer } from 'electron';
import {addCsv, query} from '../api';
import {Sheet} from "./types";
import SheetSection from "./SheetSection";

export default function App(): ReactElement {
  const [sheets, setSheets] = React.useState<Array<Sheet>>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = React.useState<number>(0);
  const [queryString, setQueryString] = React.useState('SELECT * FROM test_csv LIMIT 1');

  ipcRenderer.on('load-table-result', (event, arg) => {
    setSheets([...sheets, arg]);
    setSelectedSheetIndex(sheets.length);
  });

  ipcRenderer.on('query-result', (event, arg) => {
    setSheets([...sheets, arg]);
    setSelectedSheetIndex(sheets.length);
  });

  return (
    <>
      <div id="editorSection">
        <textarea id="editor" value={queryString} onChange={(e) => setQueryString(e.target.value)} />
      </div>
      <div id="toolbarSection">
        <button onClick={() => query(queryString)}>Run SQL</button>
        <button onClick={() => addCsv()}>Add CSV</button>
      </div>
      <div id="sheetSection">
        <SheetSection
          sheets={sheets}
          selectedSheetIndex={selectedSheetIndex}
          onSheetSelected={(index) => setSelectedSheetIndex(index)} />
      </div>
    </>
  );
}
