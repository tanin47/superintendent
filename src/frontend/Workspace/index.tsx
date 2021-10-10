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
import {altOptionChar, ctrlCmdChar} from "./constants";
import MaybeTippy from "./MaybeTippy";

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

      if (deletedSheetIndex <= selectedSheetIndex) {
        setSelectedSheetIndex(Math.max(0, selectedSheetIndex - 1));
      }
    },
    [setSheets, selectedSheetIndex, setSelectedSheetIndex]
  )

  const rearrangeSheetCallback = React.useCallback(
    (movedSheetIndex: number, newIndex: number): void => {
      setSheets((prevSheets) => {
        const copied = [...prevSheets];

        const movedSheet = copied.splice(movedSheetIndex, 1);
        copied.splice(newIndex, 0, movedSheet[0]);

        const selectedSheetName = prevSheets[selectedSheetIndex].name;
        for (let i=0;i<copied.length;i++) {
          if (copied[i].name === selectedSheetName) {
            setSelectedSheetIndex(i);
          }
        }

        return copied;
      });
    },
    [setSheets, selectedSheetIndex, setSelectedSheetIndex]
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

  const runSql = React.useCallback(
    () => {
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

  const formatSql = React.useCallback(() => {editorRef.current!.format();}, [editorRef]);
  const openAddCsvDialog = React.useCallback(() => {setShouldOpenAddCsv(true);}, [setShouldOpenAddCsv]);
  const restoreSql = React.useCallback(
    () => {
      if (sheets.length === 0) { return; }
      editorRef.current!.setValue(sheets[selectedSheetIndex].sql);
    },
[sheets, selectedSheetIndex, editorRef]
  );
  const exportCsv = React.useCallback(
    () => {
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
        10
      );
    },
    [setIsDownloadCsvLoading, sheets, selectedSheetIndex]
  );

  React.useEffect(() => {
    const handler = (event) => {
      if (event.code === 'Enter' && (event.metaKey || event.ctrlKey)) {
        runSql();
        return false;
      }

      if (event.code === 'Enter' && event.altKey) {
        formatSql();
        return false;
      }

      if (event.code === 'KeyP' && (event.metaKey || event.ctrlKey)) {
        openAddCsvDialog();
        return false;
      }

      if (event.code === 'KeyD' && (event.metaKey || event.ctrlKey)) {
        restoreSql();
        return false;
      }

      if (event.code === 'Slash' && (event.metaKey || event.ctrlKey)) {
        exportCsv();
        return false;
      }

      return true;
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler) ;
    };
  }, [runSql, formatSql, openAddCsvDialog, restoreSql, exportCsv]);

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
    if (!event.dataTransfer?.files) {
      return;
    }

    if (event.dataTransfer.files.length === 0) {
      return;
    }

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

  const isChartSelectorDisabled = sheets.length === 0 || sheets[selectedSheetIndex].count > 10000;

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
                openAddCsvDialog();
              }}
              icon={<i className="fas fa-file-upload"/>}>
              Add files
              <span className="short-key">
                {ctrlCmdChar} P
              </span>
            </Button>
          </div>
          <div className="right">
            <Button
              onClick={() => {
                shell.openExternal("https://docs.superintendent.app")
              }}
              icon={<i className="fas fa-question-circle"/>}
            >
              Docs
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
              onClick={() => {runSql();}}
              isLoading={isQueryLoading}
              icon={<i className="fas fa-play"/>}>
              Run SQL
              <span className="short-key">
                {ctrlCmdChar} ⏎
              </span>
            </Button>
            <span className="separator" />
            <Button
              onClick={() => {formatSql()}} icon={<i className="fas fa-align-justify" />}
            >
              Format
              <span className="short-key">
                {altOptionChar} ⏎
              </span>
            </Button>
            <span className="separator" />
            <Button
              onClick={() => {restoreSql();}}
              icon={<i className="fas fa-history" />}
            >
              Restore SQL
              <span className="short-key">
                {ctrlCmdChar} D
              </span>
            </Button>
          </div>
          <div className="right">
            {selectedSheetIndex < sheets.length && (
              <>
                <span className="total">
                  {formatTotal(sheets[selectedSheetIndex].count)}
                  {sheets[selectedSheetIndex].rows.length < sheets[selectedSheetIndex].count &&
                    <>
                      <span className="preview">(Only {sheets[selectedSheetIndex].rows.length.toLocaleString('en-US')} are shown)</span>
                      <Tippy
                        theme="material"
                        interactive
                        content={
                          <span className="tooltip">
                          Please export the sheet to see all the rows.
                        </span>
                        }
                      >
                        <i className="fas fa-info-circle" />
                      </Tippy>
                    </>
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
              <MaybeTippy
                theme="material"
                interactive
                content={
                  <span className="tooltip">
                    Charts cannot render more than 10,000 rows.
                  </span>
                }
                shown={sheets.length > 0 && sheets[selectedSheetIndex].count > 10000}
              >
                <div className={`select ${isChartSelectorDisabled ? 'disabled' : ''}`}>
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
                    disabled={isChartSelectorDisabled}
                  >
                    <option value="table">Table</option>
                    <option value="line">Line chart</option>
                    <option value="bar">Bar chart</option>
                    <option value="pie">Pie chart</option>
                  </select>
                </div>
              </MaybeTippy>
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
              icon={<i className="fas fa-file-download" />}
            >
              Export sheet
              <span className="short-key">
                {ctrlCmdChar} /
              </span>
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
          sheets={sheets}
          selectedSheetIndex={selectedSheetIndex}
          onSheetRenamed={(renamingSheetIndex, newName) => renamingSheetCallback(renamingSheetIndex, newName)}
          onSheetSelected={(index) => setSelectedSheetIndex(index)}
          onSheetDeleted={(deletedIndex) => deleteSheetCallback(deletedIndex)}
          onSheetRearranged={(movedSheetIndex, newIndex) => rearrangeSheetCallback(movedSheetIndex, newIndex)}
        />
      </div>
    </div>
  );
}
