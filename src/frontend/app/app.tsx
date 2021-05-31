import React, { ReactElement } from 'react';
import './app.scss';
import {addCsv, downloadCsv, query, reloadHtml} from '../api';
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
  const [isDownloadCsvLoading, setIsDownloadCsvLoading] = React.useState<boolean>(false);

  return (
    <>
      {sheets.length === 0 && (
        <div id="introSection">
          <Button
            onClick={() => {
              setIsAddCsvLoading(true);
              addCsv()
                .then((sheet) => {
                  if (!sheet) { return; }
                  setSheets([...sheets, sheet]);
                  setSelectedSheetIndex(sheets.length);
                })
                .catch((err) => {
                  alert(err.message);
                })
                .finally(() => {
                  setIsAddCsvLoading(false);
                });
            }}
            isLoading={isAddCsvLoading}
            icon={<i className="fas fa-file-upload"/>}>
            Add your first CSV
          </Button>
        </div>
      )}
      <div id="editorSection">
        <Editor ref={editorRef} sheets={sheets}/>
      </div>
      <div id="toolbarSection">
        <div className="left">
          <Button
              onClick={() => {
                setIsQueryLoading(true);
                query(editorRef.current!.getValue())
                  .then((sheet) => {
                      setSheets([...sheets, sheet]);
                      setSelectedSheetIndex(sheets.length);
                    })
                      .catch((err) => {
                        alert(err.message);
                      })
                      .finally(() => {
                        setIsQueryLoading(false);
                      });
                  }}
              isLoading={isQueryLoading}
              icon={<i className="fas fa-play"/>}>
            Run SQL
          </Button>
          <span className="separator" />
          <Button onClick={() => editorRef.current!.format()} icon={<i className="fas fa-align-justify" />}>Format</Button>
          {/*<span className="separator" />*/}
          {/*<Button onClick={() => reloadHtml()} icon={<i className="fas fa-sync" />}>Reload HTML</Button>*/}
        </div>
        <div className="right">
          <Button
            onClick={() => {
              setIsAddCsvLoading(true);
              addCsv()
                .then((sheet) => {
                  if (!sheet) { return; }
                  setSheets([...sheets, sheet]);
                  setSelectedSheetIndex(sheets.length);
                })
                .catch((err) => {
                  alert(err.message);
                })
                .finally(() => {
                  setIsAddCsvLoading(false);
                });
            }}
            isLoading={isAddCsvLoading}
            icon={<i className="fas fa-file-upload"/>}>
            Add more CSV
          </Button>
          <span className="separator" />
          <Button
            onClick={() => {
                setIsDownloadCsvLoading(true);
                downloadCsv(sheets[selectedSheetIndex].name)
                  .then((filePath) => {
                    if (!filePath) { return; }
                    alert(`The table is saved at: ${filePath}`);
                  })
                  .catch((err) => {
                    alert(err.message);
                  })
                  .finally(() => {
                    setIsDownloadCsvLoading(false);
                  });
              }}
              isLoading={isDownloadCsvLoading}
              disabled={sheets.length === 0}
              icon={<i className="fas fa-file-download" />}>
            Export current sheet
          </Button>
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
