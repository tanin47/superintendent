import React, {ReactElement} from 'react';
import './index.scss';
import {downloadCsv, drop, getInitialEditorMode, query, getInitialFile, convertFileList, rename} from '../api';
import {EditorMode, EditorModeChannel} from '../../types';
import {PresentationType, Sheet} from './types';
import SheetSection from './SheetSection';
import Button from './Button';
import Editor, {Ref as EditorRef} from './Editor';
import * as dialog from './dialog';
import {formatTotal} from "./helper";
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/material.css';
import {ipcRenderer, shell} from "electron";
import AddCsv, {Ref as AddCsvRef} from "./AddCsvModal";
import { IpcRendererEvent } from 'electron/renderer';

export default function Workspace({evaluationMode}: {evaluationMode: boolean}): ReactElement {
  const [editorMode, setEditorMode] = React.useState<EditorMode>(getInitialEditorMode());

  React.useEffect(() => {
    const callback = (event, mode: any) => { setEditorMode(mode as EditorMode); };
    ipcRenderer.on(EditorModeChannel, callback);

    return () => {
      ipcRenderer.removeListener(EditorModeChannel, callback) ;
    };
  }, [setEditorMode]);

  const [sheets, setSheets] = React.useState<Array<Sheet>>([]);
  const [shouldOpenAddCsv, setShouldOpenAddCsv] = React.useState<boolean>(false);
  const [selectedSheetIndex, setSelectedSheetIndex] = React.useState<number>(0);
  const editorRef = React.createRef<EditorRef>();

  const [isQueryLoading, setIsQueryLoading] = React.useState<boolean>(false);
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

  const addNewSheetCallback = React.useCallback(
    (sheet: Sheet | null): void => {
      if (!sheet) { return; }
      setSheets((prevSheets) => {
        setSelectedSheetIndex(prevSheets.length);
        return [...prevSheets, sheet]
      });
    },
    [setSheets, setSelectedSheetIndex]
  );

  const deleteSheetCallback = React.useCallback(
    (deletedSheetIndex: number): void => {
      setSheets((prevSheets) => {
        drop(prevSheets[deletedSheetIndex].name)
          .then(() => {
            // don't care.
          });
        return prevSheets.filter((sheet, index) => index !== deletedSheetIndex);
      });
    },
    [setSheets]
  )

  const renamingSheetCallback = React.useCallback(
    (renamingSheetIndex: number, newName: string): void => {
      setSheets((prevSheets) => {
        return prevSheets.map((sheet, index) => {
          if (index === renamingSheetIndex) {
            return {
              ...sheet,
              name: newName
            }
          } else {
            return sheet;
          }
        });
      });
    },
    [setSheets, sheets]
  )

  const submitHandler = React.useMemo(
    () => () => {
      if (isQueryLoading) { return; }
      if (!editorRef.current) { return; }
      const value = editorRef.current.getValue();

      setIsQueryLoading(true);
      query(value)
        .then((sheet) => addNewSheetCallback(sheet))
        .catch((err) => {
          dialog.showError('Found an error!', err.message);
        })
        .finally(() => {
          setIsQueryLoading(false);
        });
    },
    [setIsQueryLoading, setSheets, setSelectedSheetIndex, sheets, isQueryLoading, editorRef, addNewSheetCallback]
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

  const addCsvRef = React.createRef<AddCsvRef>();
  const addFiles = React.useCallback((files: string[]) => {
    addCsvRef.current!.addFiles(files);
    setShouldOpenAddCsv(true);
  }, [addCsvRef]);
  const fileDroppedCallback = React.useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    addFiles(convertFileList(event.dataTransfer?.files));
  }, [addFiles]);

  const alreadyInitialized = React.useRef<boolean>(false);
  React.useEffect(() => {
    if (alreadyInitialized.current) { return; }
    if (!addCsvRef.current) { return; }

    const file = getInitialFile();

    if (!file) { return; }

    addFiles([file]);
    alreadyInitialized.current = true;
  }, [addFiles])

  React.useEffect(() => {
    const listener = (event: IpcRendererEvent, path: string) => {
      addFiles([path]);
    };
    ipcRenderer.on('open-file', listener);
    return () => {
      ipcRenderer.removeListener('open-file', listener);
    }
  }, [addFiles])

  return (
    <div
      id="workspace"
       onDragOver={(e) => {
         e.stopPropagation();
         e.preventDefault();
       }}
       onDrop={fileDroppedCallback}
    >
      <AddCsv
        ref={addCsvRef}
        isOpen={shouldOpenAddCsv}
        onClose={() => setShouldOpenAddCsv(false)}
        onAdded={(sheet) => addNewSheetCallback(sheet)}
      />
      <div className="toolbarSection top">
        <div className="inner">
          <div className="left">
            <Button
              onClick={() => {
                setShouldOpenAddCsv(true);
              }}
              icon={<i className="fas fa-file-upload"/>}>
              Add files
            </Button>
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
            <span className="separator" />
            <Button onClick={() => editorRef.current!.setValue(sheets[selectedSheetIndex].sql)} icon={<i className="fas fa-history" />}>Restore SQL</Button>
          </div>
          <div className="right">
            {selectedSheetIndex < sheets.length && (
              <>
                <span className="total">
                  {formatTotal(sheets[selectedSheetIndex].count)}
                  {sheets[selectedSheetIndex].rows.length < sheets[selectedSheetIndex].count &&
                    <Tippy
                      theme="material"
                      interactive
                      content={
                        <span className="tooltip">
                          Only {sheets[selectedSheetIndex].rows.length.toLocaleString('en-US')} rows are previewed. Please export the sheet to see all the rows.
                        </span>
                      }
                    >
                      <i className="fas fa-info-circle" />
                    </Tippy>
                  }
                  {evaluationMode && (
                    <Tippy
                      theme="material"
                      interactive
                      content={
                        <span className="tooltip">
                          In the evaluation mode, you can load up to 100 rows per CSV. Please <span className="link" onClick={() => shell.openExternal("https://superintendent.app/buy")}>get a license</span> in order to get full access.
                        </span>
                      }
                    >
                      <i className="fas fa-info-circle" />
                    </Tippy>
                  )}
                </span>
                <span className="separator" />
              </>
            )}
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
                // Add some delay for the UI to be updated.
                setTimeout(
                    () => {
                      downloadCsv(sheets[selectedSheetIndex].name)
                          .then((filePath) => {
                            if (!filePath) { return; }

                            dialog.showSuccess('Exported!', `The sheet has been exported to: ${filePath}`);
                          })
                          .catch((err) => {
                            dialog.showError('Found an error!', err.message);
                          })
                          .finally(() => {
                            setIsDownloadCsvLoading(false);
                          });
                    },
                    100
                );
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
          onSheetRenamed={(renamingSheetIndex, newName) => renamingSheetCallback(renamingSheetIndex, newName)}
          onSheetSelected={(index) => setSelectedSheetIndex(index)}
          onSheetDeleted={(deletedIndex) => deleteSheetCallback(deletedIndex)} />
      </div>
    </div>
  );
}
