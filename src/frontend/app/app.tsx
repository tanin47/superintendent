import React, { ReactElement } from 'react';
import './app.scss';
import { ipcRenderer } from 'electron';
import {addCsv, query, reloadHtml} from '../api';
import {Sheet} from "./types";
import SheetSection from "./SheetSection";
import Button from "./Button";
import Editor from "./Editor";
import {Ref as EditorRef} from "./Editor";

export default function App(): ReactElement {
  const [sheets, setSheets] = React.useState<Array<Sheet>>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = React.useState<number>(0);
  const editorRef = React.createRef<EditorRef>();

  const [isQueryLoading, setIsQueryLoading] = React.useState<boolean>(false);
  const [isAddCsvLoading, setIsAddCsvLoading] = React.useState<boolean>(false);

  const loadTableResultCallback = React.useCallback((event, arg) => {
    setSheets([...sheets, arg]);
    setSelectedSheetIndex(sheets.length);
    setIsAddCsvLoading(false);
  }, [sheets]);
  const queryResultCallback = React.useCallback((event, arg) => {
    setSheets([...sheets, arg]);
    setSelectedSheetIndex(sheets.length);
    setIsQueryLoading(false);
  }, [sheets]);

  React.useEffect(() => {
    ipcRenderer.on('load-table-result', loadTableResultCallback);
    ipcRenderer.on('query-result', queryResultCallback);

    return () => {
      ipcRenderer.removeListener('load-table-result', loadTableResultCallback);
      ipcRenderer.removeListener('query-result', queryResultCallback);
    };
  }, [loadTableResultCallback, queryResultCallback])

  return (
    <>
      <div id="editorSection">
        <Editor ref={editorRef} sheets={sheets}/>
      </div>
      <div id="toolbarSection">
        <div className="left">
          <Button
              onClick={() => {
                setIsQueryLoading(true);
                query(editorRef.current!.getValue());
              }}
              isLoading={isQueryLoading}
              icon={<i className="fas fa-play"/>}>
            Run SQL
          </Button>
          <span className="separator" />
          <Button
              onClick={() => {
                setIsAddCsvLoading(true);
                addCsv();
              }}
              isLoading={isAddCsvLoading}
              icon={<i className="fas fa-file-upload"/>}>
            Add CSV
          </Button>
          <span className="separator" />
          <Button onClick={() => reloadHtml()} icon={<i className="fas fa-sync" />}>Reload HTML</Button>
        </div>
        <div className="right">
          <Button icon={<i className="fas fa-file-download" />}>Export CSV</Button>
        </div>
      </div>
      <div id="sheetSection" className={sheets.length === 0 ? 'empty' : ''}>
        <SheetSection
          sheets={sheets}
          selectedSheetIndex={selectedSheetIndex}
          onSheetSelected={(index) => setSelectedSheetIndex(index)}
          onSheetDeleted={(deletedIndex) => setSheets(sheets.filter((sheet, index) => index !== deletedIndex))} />
      </div>
    </>
  );
}
