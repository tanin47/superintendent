import React, {ReactElement} from 'react';
import './index.scss';
import {convertFileList, downloadCsv, drop, getInitialEditorMode, getInitialFile, query} from '../api';
import {EditorMode, EditorModeChannel, ExportedWorkflow, ImportWorkflowChannel} from '../../types';
import {PresentationType, PresentationTypes, Sheet} from './types';
import SheetSection, {Ref as SheetSectionRef} from './SheetSection';
import Button from './Button';
import Editor, {Ref as EditorRef} from './Editor';
import * as dialog from './dialog';
import {formatTotal, isChartEnabled} from "./helper";
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/material.css';
import {ipcRenderer, shell} from "electron";
import AddCsv, {Ref as AddCsvRef} from "./AddCsvModal";
import {IpcRendererEvent} from 'electron/renderer';
import {altOptionChar, ctrlCmdChar} from "./constants";
import MaybeTippy from "./MaybeTippy";
import Workflow, {Ref as WorkflowRef} from "./Workflow";
import RenameDialog from "./RenameDialog";

export type EditorOrWorkflow = 'editor' | 'workflow';

const PresentationTypeLabel = {
  table: 'Table',
  line: 'Line chart',
  pie: 'Pie chart',
  bar: 'Bar chart'
};

type SheetInfo = {
  name: string,
  showCount: number,
  totalRowCount: number
};

export default function Workspace({evaluationMode}: {evaluationMode: boolean}): ReactElement {
  const [editorMode, setEditorMode] = React.useState<EditorMode>(getInitialEditorMode());
  const [sheets, setSheets] = React.useState<Array<Sheet>>([]);
  const [renamingSheetIndex, setRenamingSheetIndex] = React.useState<number | null>(null);
  const [showEditorOrWorkflow, setShowEditorOrWorkflow] = React.useState<EditorOrWorkflow>('editor');
  const [editorSelectedSheetIndex, setEditorSelectedSheetIndex] = React.useState<number | null>(null);
  const [isZoomInEnabled, setIsZoomInEnabled] = React.useState<boolean>(true);
  const [isZoomOutEnabled, setIsZoomOutEnabled] = React.useState<boolean>(true);

  const [shownSheetInfo, setShownSheetInfo] = React.useState<SheetInfo | null>(null);
  const [blinkingShownSheetCount, setBlinkingShownSheetCount] = React.useState<boolean>(false);
  const blinkingShownSheetCountTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [presentationType, setPresentationType] = React.useState<PresentationType>('table');

  const workflowRef = React.useRef<WorkflowRef>(null);
  const sheetSectionRef = React.useRef<SheetSectionRef>(null);

  React.useEffect(() => {
    const callback = (event, workflow: ExportedWorkflow) => {
      workflowRef.current!.reset();
      setEditorSelectedSheetIndex(null);
      setShowEditorOrWorkflow('workflow');
      setSheets(workflow.nodes.map((node) => ({
        name: node.name,
        isCsv: node.isCsv,
        dependsOn: node.dependsOn,
        position: node.position,
        sql: node.sql,
        count: 0,
        columns: [],
        rows: [],
        presentationType: 'table',
        scrollLeft: null,
        scrollTop: null,
        resizedColumns: {},
        selection: null,
        userSelect: null
      })));
    };
    ipcRenderer.on(ImportWorkflowChannel, callback);

    return () => {
      ipcRenderer.removeListener(ImportWorkflowChannel, callback) ;
    };
  }, [showEditorOrWorkflow]);

  React.useEffect(() => {
    const callback = (event, mode: any) => { setEditorMode(mode as EditorMode); };
    ipcRenderer.on(EditorModeChannel, callback);

    return () => {
      ipcRenderer.removeListener(EditorModeChannel, callback) ;
    };
  }, [setEditorMode]);

  const [shouldOpenAddCsv, setShouldOpenAddCsv] = React.useState<boolean>(false);
  const editorRef = React.useRef<EditorRef>(null);

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
    (newSheet: Sheet | null): void => {
      if (!newSheet) { return; }
      const foundIndex = sheets.findIndex((s) => s.name === newSheet.name);

      if (foundIndex > -1) {
        sheets.splice(foundIndex, 1, newSheet);
        setSheets([...sheets]);
      } else {
        sheets.push(newSheet);
        setSheets([...sheets]);
        setEditorSelectedSheetIndex(sheets.length - 1);
      }
    },
    [sheets]
  );

  const deleteSheetCallback = React.useCallback(
    (deletedSheetIndex: number): void => {
      const name = sheets[deletedSheetIndex].name;
      const downstreams = sheets.filter((s) => s.dependsOn.includes(name));
      let confirmMsg = `Are you sure you want to remove: ${sheets[deletedSheetIndex].name}?`;
      if (downstreams.length > 0) {
        const dependClause = downstreams.length === 1 ? `${downstreams.length} other table depends on it.` : `${downstreams.length} other tables depend on it.`;
        confirmMsg += `\n\n ${dependClause}`;
      }
      if (!confirm(confirmMsg)) {
        return;
      }

      drop(sheets[deletedSheetIndex].name)
        .then(() => {
          // don't care.
        });
      const updatedSheets = sheets.filter((sheet, index) => index !== deletedSheetIndex);

      setSheets(updatedSheets);

      if (editorSelectedSheetIndex !== null) {
        if (deletedSheetIndex < editorSelectedSheetIndex) {
          setEditorSelectedSheetIndex(editorSelectedSheetIndex - 1);
        } else if (deletedSheetIndex === editorSelectedSheetIndex) {
          setEditorSelectedSheetIndex(null);
        }
      }
    },
    [sheets, setSheets, editorSelectedSheetIndex, setEditorSelectedSheetIndex]
  )

  const runSql = React.useCallback(
    () => {
      if (isQueryLoading) { return; }
      if (!editorRef.current) { return; }
      const value = editorRef.current.getValue();

      setIsQueryLoading(true);
      query(
        value,
        editorSelectedSheetIndex !== null ? sheets[editorSelectedSheetIndex].name : null
      )
        .then((sheet) => addNewSheetCallback(sheet))
        .catch((err) => {
          dialog.showError('Found an error!', err.message);
        })
        .finally(() => {
          setIsQueryLoading(false);
        });
    },
    [sheets, isQueryLoading, addNewSheetCallback, editorSelectedSheetIndex]
  );

  const formatSql = React.useCallback(() => {editorRef.current!.format();}, []);
  const openAddCsvDialog = React.useCallback(() => {setShouldOpenAddCsv(true);}, [setShouldOpenAddCsv]);
  const exportCsv = React.useCallback(
    () => {
      setIsDownloadCsvLoading(true);
      // Add some delay for the UI to be updated.
      setTimeout(
        () => {
          const tab = sheetSectionRef.current!.getSelectedTab();
          if (!tab) { return; }

          downloadCsv(tab.sheet.name)
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
        1
      );
    },
    []
  );
  const toggleEditorWorkflow = React.useCallback(
    () => {
      setShowEditorOrWorkflow(showEditorOrWorkflow === 'editor' ? 'workflow' : 'editor')
    },
    [showEditorOrWorkflow]
  );
  const makeNewQuery = React.useCallback(
    () => {
      setEditorSelectedSheetIndex(null);
    },
    []
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

      if (event.code === 'KeyE' && (event.metaKey || event.ctrlKey)) {
        exportCsv();
        return false;
      }

      if (event.code === 'KeyW' && (event.metaKey || event.ctrlKey)) {
        toggleEditorWorkflow();
        return false;
      }

      if (event.code === 'KeyN' && (event.metaKey || event.ctrlKey)) {
        makeNewQuery();
        return false;
      }

      return true;
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler) ;
    };
  }, [runSql, formatSql, openAddCsvDialog, exportCsv, toggleEditorWorkflow, makeNewQuery]);

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

  const addCsvRef = React.useRef<AddCsvRef>(null);
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

  React.useEffect(
    () => {
      if (showEditorOrWorkflow === 'editor') {
        if (editorRef.current) {
          editorRef.current.focus();
        }
      }
    },
    [showEditorOrWorkflow]
  )

  let editorOrWorkflowToolbar: JSX.Element;

  switch (showEditorOrWorkflow) {
    case 'editor':
      editorOrWorkflowToolbar = (
        <>
          <Button
            onClick={() => {runSql();}}
            isLoading={isQueryLoading}
            icon={<i className="fas fa-play"/>}>
            {editorSelectedSheetIndex !== null ? 'Update SQL' : 'Create SQL'}
            <span className="short-key">
                {ctrlCmdChar} ⏎
              </span>
          </Button>
          <span className="separator" />
          {editorSelectedSheetIndex !== null && (
            <>
              <Button
                onClick={() => makeNewQuery()}
                icon={<i className="fas fa-plus-square"/>}>
                New SQL
                <span className="short-key">
                    {ctrlCmdChar} N
                  </span>
              </Button>
              <span className="separator" />
            </>
          )}
          <Button
            onClick={() => {formatSql()}} icon={<i className="fas fa-align-justify" />}
          >
            Format
            <span className="short-key">
                {altOptionChar} ⏎
              </span>
          </Button>
          <span className="separator" />
          {editorSelectedSheetIndex === null ? (
            <div className="info">You are making a new query</div>
          ) : (
            <div className="info">You are editing <span className="table">{sheets[editorSelectedSheetIndex].name}</span></div>
          )}
        </>
      );
      break;
    case 'workflow':
      editorOrWorkflowToolbar = (
        <>
          <Button
            onClick={() => workflowRef.current!.zoomIn()}
            icon={<i className="fas fa-search-plus"/>}
            disabled={!isZoomInEnabled}
          >
            Zoom in
          </Button>
          <span className="separator" />
          <Button
            onClick={() => workflowRef.current!.zoomOut()}
            icon={<i className="fas fa-search-minus"/>}
            disabled={!isZoomOutEnabled}
          >
            Zoom out
          </Button>
          <span className="separator" />
          <Button
            onClick={() => workflowRef.current!.fitView()}
            icon={<i className="fas fa-compress"/>}
          >
            Fit view
          </Button>
          <span className="separator" />
          <Button
            onClick={() => workflowRef.current!.arrange()}
            icon={<i className="fas fa-random"/>}
          >
            Arrange
          </Button>
        </>
      );
      break;
    default:
      throw new Error()
  }

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
        sheets={sheets}
        onClose={() => setShouldOpenAddCsv(false)}
        onAdded={(sheet) => addNewSheetCallback(sheet)}
      />
      <RenameDialog
        renamingSheet={renamingSheetIndex !== null ? sheets[renamingSheetIndex] : null}
        onUpdated={(newName) => {
          if (renamingSheetIndex !== null) {
            setSheets((prevSheets) => {
              return prevSheets.map((sheet, index) => {
                if (index === renamingSheetIndex) {
                  return {
                    ...sheet,
                    name: newName,
                    previousName: sheet.name
                  }
                } else {
                  return sheet;
                }
              });
            });
          }
          setRenamingSheetIndex(null);
        }}
        onClosed={() => setRenamingSheetIndex(null)}
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
            <span className="separator" />
            <Button
              onClick={() => toggleEditorWorkflow()}
              icon={<i className={`fas ${showEditorOrWorkflow === 'editor' ? 'fa-th-large' : 'fa-edit'}`} />}>
              {showEditorOrWorkflow === 'editor' ? 'Workflow' : 'Editor'}
              <span className="short-key">
                {ctrlCmdChar} W
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
        <Workflow
          ref={workflowRef}
          visible={showEditorOrWorkflow === 'workflow'}
          sheets={sheets}
          onSheetClicked={(sheetId) => {
            const index = sheets.findIndex((s) => s.name === sheetId);
            const sheet = sheets[index];
            if (sheet.isCsv) {
              editorRef.current!.setValue(sheet.sql);
              setEditorSelectedSheetIndex(null);
            } else {
              setEditorSelectedSheetIndex(index);
            }
            setShowEditorOrWorkflow('editor');
            sheetSectionRef.current!.open(sheetId);
          }}
          onSheetTabOpened={(sheetId) => sheetSectionRef.current!.open(sheetId)}
          onSheetRenamed={(renamingSheetIndex) => setRenamingSheetIndex(renamingSheetIndex)}
          onSheetDeleted={(deletedIndex) => deleteSheetCallback(deletedIndex)}
          onZoomInEnabled={(enabled) => setIsZoomInEnabled(enabled)}
          onZoomOutEnabled={(enabled) => setIsZoomOutEnabled(enabled)}
          editorSelectedSheetIndex={editorSelectedSheetIndex}
        />
        <Editor
          ref={editorRef}
          mode={editorMode}
          sheets={sheets}
          selectedSheetIndex={editorSelectedSheetIndex}
          visible={showEditorOrWorkflow === 'editor'}
        />
      </div>
      <div className="toolbarSection">
        <div
          className="resize-bar"
          onMouseDown={mouseDownHandler}
        />
        <div className="inner" unselectable="on">
          <div className="left">
            {editorOrWorkflowToolbar}
          </div>
          <div className="right">
            {shownSheetInfo && (
              <>
                <span className={`total ${blinkingShownSheetCount ? 'blinking' : ''}`}>
                  {formatTotal(shownSheetInfo.totalRowCount)}
                  {shownSheetInfo.showCount < shownSheetInfo.totalRowCount &&
                    <>
                      <span className="preview">(Only {shownSheetInfo.showCount.toLocaleString('en-US')} are shown)</span>
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
                    Charts cannot render more than 11,000 rows.
                  </span>
                }
                shown={!isChartEnabled(shownSheetInfo?.showCount)}
              >
                <div className={`select ${isChartEnabled(shownSheetInfo?.showCount) ? '' : 'disabled'}`}>
                  <select
                    value={presentationType}
                    onChange={(event) => {
                      setPresentationType(event.target.value as PresentationType);
                    }}
                    disabled={!isChartEnabled(shownSheetInfo?.showCount)}
                  >
                    {PresentationTypes.map((value) => {
                      return (
                        <option key={value} value={value}>{PresentationTypeLabel[value]}</option>
                      )
                    })}
                  </select>
                </div>
              </MaybeTippy>
            </div>
            <span className="separator" />
            <Button
              onClick={() => exportCsv()}
              isLoading={isDownloadCsvLoading}
              disabled={sheets.length === 0}
              icon={<i className="fas fa-file-download" />}
            >
              Export sheet
              <span className="short-key">
                {ctrlCmdChar} E
              </span>
            </Button>
          </div>
        </div>
        <div
          className="resize-bar"
          onMouseDown={mouseDownHandler}
        />
      </div>
        <SheetSection
          ref={sheetSectionRef}
          sheets={sheets}
          editorSelectedSheetIndex={editorSelectedSheetIndex}
          onSheetRenamed={(renamingSheetIndex) => setRenamingSheetIndex(renamingSheetIndex)}
          presentationType={presentationType}
          onSelectedSheetUpdated={(newSheet) => {
            let info: SheetInfo | null = null

            if (newSheet) {
              info = {
                name: newSheet.name,
                showCount: newSheet.rows.length,
                totalRowCount: newSheet.count
              };
            }

            if (!isChartEnabled(info?.showCount)) {
              setPresentationType('table');
            }

            setShownSheetInfo((prev) => {
              if (!!prev && !!info && prev.name === info.name && prev.showCount < info.showCount) {
                if (blinkingShownSheetCountTimeoutRef.current) {
                  clearInterval(blinkingShownSheetCountTimeoutRef.current);
                }

                setBlinkingShownSheetCount(true);
                blinkingShownSheetCountTimeoutRef.current = setTimeout(
                  () => {
                    setBlinkingShownSheetCount(false)
                  },
                  1500
                );
              }

              return info;
            });
          }}
        />
    </div>
  );
}
