import React, { ReactElement } from 'react';
import './index.scss';
import {addCsv, downloadCsv, query, reloadHtml} from '../api';
import {EditorMode, PresentationType, Sheet} from './types';
import SheetSection from './SheetSection';
import Button from './Button';
import Editor from './Editor';
import {Ref as EditorRef} from './Editor';
import Store from "electron-store";

export default function Workspace({evaluationMode}: {evaluationMode: boolean}): ReactElement {
  const store = React.useMemo(() => new Store(), []);

  const defaultEditorMode = (store.get('editorMode') as EditorMode | null) || 'default';
  const [editorMode, setEditorMode] = React.useState<EditorMode>(defaultEditorMode);

  React.useEffect(() => {
    store.set('editorMode', editorMode);
  }, [store, editorMode])

  const [sheets, setSheets] = React.useState<Array<Sheet>>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = React.useState<number>(0);
  const editorRef = React.createRef<EditorRef>();

  const [isQueryLoading, setIsQueryLoading] = React.useState<boolean>(false);
  const [isAddCsvLoading, setIsAddCsvLoading] = React.useState<boolean>(false);
  const [isDownloadCsvLoading, setIsDownloadCsvLoading] = React.useState<boolean>(false);

  const [isResizing, setIsResizing] = React.useState<boolean>(false);
  const [editorHeight, setEditorHeight] = React.useState<number>(250);
  const [mouseDownY, setMouseDownY] = React.useState<number>(0);
  const [mouseDownEditorHeight, setMouseDownEditorHeight] = React.useState<number>(editorHeight);

  const mouseDownHandler = (event: React.MouseEvent) => {
    setMouseDownY(event.clientY);
    setMouseDownEditorHeight(editorHeight);
    setIsResizing(true);
  };

  const submitHandler = React.useMemo(
    () => () => {
      if (isQueryLoading) { return; }
      if (!editorRef.current) { return; }
      const value = editorRef.current.getValue();

      setIsQueryLoading(true);
      query(value)
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
    },
    [setIsQueryLoading, setSheets, setSelectedSheetIndex, sheets, isQueryLoading, editorRef]
  );

  React.useEffect(() => {
    const handler = (event) => {
      if (event.code === 'Enter' && (event.metaKey || event.ctrlKey)) {
        submitHandler();
        return false;
      }

      return true;
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler) ;
    };
  }, [submitHandler]);

  React.useEffect(() => {
    const handler = (event) => {
      if (!isResizing) { return; }

      setEditorHeight(Math.min(window.innerHeight - 200, Math.max(event.clientY - mouseDownY + mouseDownEditorHeight, 50)));
    };
    document.addEventListener('mousemove', handler);

    return () => {
      document.removeEventListener('mousemove', handler) ;
    };
  }, [isResizing, mouseDownEditorHeight, mouseDownY]);

  React.useEffect(() => {
    const handler = (event) => {
      if (!isResizing) {
        return;
      }
      setIsResizing(false);
    };
    document.addEventListener('mouseup', handler);

    return () => {
      document.removeEventListener('mouseup', handler);
    }
  }, [isResizing, setIsResizing]);

  return (
    <div id="workspace">
      <div className="toolbarSection top">
        <div className="inner">
          <div className="left">
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
              Add CSV
            </Button>
          </div>
          <div className="right">
            <div className="mode">
              Mode:
              <div className="selector">
                <div className="select">
                  <select
                    value={editorMode}
                    onChange={(event) => {
                      setEditorMode(event.target.value as EditorMode);
                    }}
                  >
                    <option value="default">Normal</option>
                    <option value="vim">Vim</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div id="editorSection" style={{height: editorHeight}}>
        <Editor ref={editorRef} mode={editorMode} sheets={sheets}/>
      </div>
      <div className="toolbarSection">
        <div
          className="resize-bar"
          onMouseDown={mouseDownHandler}
        />
        <div className="inner" unselectable="on">
          <div className="left">
            <Button
              onClick={submitHandler}
              isLoading={isQueryLoading}
              icon={<i className="fas fa-play"/>}>
              Run SQL
            </Button>
            <span className="separator" />
            <Button onClick={() => editorRef.current!.format()} icon={<i className="fas fa-align-justify" />}>Format</Button>
            {!process.env.SUPERINTENDENT_IS_PROD && (
              <>
                <span className="separator" />
                <Button onClick={() => reloadHtml()} icon={<i className="fas fa-sync" />}>Reload HTML</Button>
              </>
            )}
          </div>
          <div className="right">
            <div className="selector">
              <div className={`select ${sheets.length === 0 ? 'disabled' : ''}`}>
                <select
                  value={sheets[selectedSheetIndex]?.presentationType || 'table'}
                  onChange={(event) => {
                     setSheets(sheets.map((sheet, index) => {
                       if (selectedSheetIndex === index) {
                          sheet.presentationType = event.target.value as PresentationType;
                       }

                       return sheet;
                     }));
                  }}
                  disabled={sheets.length === 0}
                >
                  <option value="table">Table</option>
                  <option value="line">Line chart</option>
                  <option value="bar">Bar chart</option>
                  <option value="pie">Pie chart</option>
                </select>
              </div>
            </div>
            <span className="separator" />
            <Button
              onClick={() => {
                setIsDownloadCsvLoading(true);
                downloadCsv(sheets[selectedSheetIndex].name)
                  .then((filePath) => {
                    if (!filePath) { return; }
                    alert(`The sheet has been exported to: ${filePath}`);
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
              Export sheet
            </Button>
          </div>
        </div>
        <div
          className="resize-bar"
          onMouseDown={mouseDownHandler}
        />
      </div>
      <div id="sheetSection" className={sheets.length === 0 ? 'empty' : ''}>
        <SheetSection
          evaluationMode={evaluationMode}
          sheets={sheets}
          selectedSheetIndex={selectedSheetIndex}
          onSheetSelected={(index) => setSelectedSheetIndex(index)}
          onSheetDeleted={(deletedIndex) => setSheets(sheets.filter((sheet, index) => index !== deletedIndex))} />
      </div>
    </div>
  );
}
