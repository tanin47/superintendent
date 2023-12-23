import React, {ReactElement} from 'react';
import './index.scss';
import {downloadCsv, drop, getInitialEditorMode, query, sort} from '../api';
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
import {ctrlCmdChar} from "./constants";
import MaybeTippy from "./MaybeTippy";
import Project from "./Project";
import ResizeBar from "./ResizeBar";
import RenameDialog from "./RenameDialog";

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

export default function Workspace(): ReactElement {
  const [editorMode, setEditorMode] = React.useState<EditorMode>(getInitialEditorMode());
  const [sheets, setSheets] = React.useState<Array<Sheet>>([]);
  const [editorSelectedSheetName, setEditorSelectedSheetName] = React.useState<string | null>(null);
  const [renamingSheetName, setRenamingSheetName] = React.useState<string | null>(null);

  const [shownSheetInfo, setShownSheetInfo] = React.useState<SheetInfo | null>(null);
  const [blinkingShownSheetCount, setBlinkingShownSheetCount] = React.useState<boolean>(false);
  const blinkingShownSheetCountTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [presentationType, setPresentationType] = React.useState<PresentationType>('table');
  const sheetSectionRef = React.useRef<SheetSectionRef>(null);

  React.useEffect(() => {
    const callback = (event, workflow: ExportedWorkflow) => {
      setEditorSelectedSheetName(null);
      setSheets((prevSheets) => {
        return [
          ...prevSheets,
          ...workflow.sheets.map((sheet) => ({
            name: sheet.name,
            isCsv: sheet.isCsv,
            sql: sheet.sql,
            dependsOn: [],
            count: 0,
            columns: [],
            rows: [],
            sorts: [],
            presentationType: 'table',
            scrollLeft: null,
            scrollTop: null,
            resizedColumns: {},
            selection: null,
            userSelect: null,
            editorState: null,
            isLoading: false,
          } as Sheet))
        ];
      });
    };
    const removeListener = window.ipcRenderer.on(ImportWorkflowChannel, callback);
    (window as any).importWorkflowHookIsLoaded = true;

    return () => {
      removeListener();
    };
  }, []);

  React.useEffect(() => {
    const callback = (event, mode: any) => { setEditorMode(mode as EditorMode); };
    const removeListener = window.ipcRenderer.on(EditorModeChannel, callback);

    return () => {
      removeListener();
    };
  }, [setEditorMode]);

  const editorRef = React.useRef<EditorRef>(null);

  const [isDownloadCsvLoading, setIsDownloadCsvLoading] = React.useState<boolean>(false);

  const [editorHeight, setEditorHeight] = React.useState<number>(250);
  const [projectWidth, setProjectWidth] = React.useState<number>(250);

  const addNewSheetCallback = React.useCallback(
    (newSheet: Sheet | null): void => {
      if (!newSheet) { return; }

      setSheets((sheets) => {
        const foundIndex = sheets.findIndex((s) => s.name === newSheet.name);

        if (foundIndex > -1) {
          sheets.splice(foundIndex, 1, newSheet);
          setTimeout(() => sheetSectionRef.current!.open(newSheet.name), 1);
        } else {
          sheets.push(newSheet);

          if (!newSheet.isCsv) {
            setEditorSelectedSheetName(sheets[sheets.length - 1].name);
          }
        }

        return [...sheets];
      });
    },
    []
  );

  const deleteSheetCallback = React.useCallback(
    (name: string): void => {
      const downstreams = sheets.filter((s) => s.dependsOn.includes(name));
      let confirmMsg = `Are you sure you want to remove: ${name}?`;
      if (downstreams.length > 0) {
        const dependClause = downstreams.length === 1 ? `${downstreams.length} other table depends on it.` : `${downstreams.length} other tables depend on it.`;
        confirmMsg += `\n\n ${dependClause}`;
      }
      if (!confirm(confirmMsg)) {
        return;
      }

      drop(name)
        .then(() => {
          // don't care.
        });
      const updatedSheets = sheets.filter((sheet) => sheet.name !== name);

      setSheets(updatedSheets);

      if (name === editorSelectedSheetName) {
        setEditorSelectedSheetName(null);
      }
    },
    [sheets, editorSelectedSheetName]
  );

  const runSql = React.useCallback(
    async (sql: string, sheetName: string | null) => {
      const found = sheets.find((s) => s.name === sheetName);

      if (found) {
        found.isLoading = true;
        setSheets([...sheets])
      }

      const sheet = await query(
        sql,
        sheetName
      );
      addNewSheetCallback(sheet);
      return sheet;
    },
    [sheets, addNewSheetCallback]
  );

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
  const makeNewQuery = React.useCallback(
    () => {
      setEditorSelectedSheetName(null);
    },
    []
  );

  React.useEffect(() => {
    const handler = (event) => {

      if (event.code === 'KeyN' && (event.metaKey || event.ctrlKey)) {
        makeNewQuery();
        return false;
      }

      if (event.code === 'KeyE' && (event.metaKey || event.ctrlKey)) {
        exportCsv();
        return false;
      }

      return true;
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler) ;
    };
  }, [exportCsv, makeNewQuery]);

  const ensureValidSize = React.useCallback(
    () => {
      if ((projectWidth + 300) > window.innerWidth) {
        setProjectWidth(window.innerWidth - 300);
      }

      if ((editorHeight + 200) > window.innerHeight) {
        setEditorHeight(window.innerHeight - 200)
      }
    },
    [editorHeight, projectWidth]
  )

  React.useEffect(
    () => {
      window.addEventListener('resize', ensureValidSize);

      return () => {
        window.removeEventListener('resize', ensureValidSize);
      };
    },
    [ensureValidSize]
  )

  const onEditorSheetResizing = React.useCallback(
    (initial, dx, dy) => {
      setEditorHeight(Math.min(window.innerHeight - 200, Math.max(dy + initial, 100)));
    },
    []
  );

  return (
    <div
      id="workspace"
       onDragOver={(e) => {
         e.stopPropagation();
         e.preventDefault();
       }}
    >
      <RenameDialog
        renamingSheet={sheets.find((s) => s.name === renamingSheetName) ?? null}
        onUpdated={(newName) => {
          if (renamingSheetName !== null) {
            setSheets((prevSheets) => {
              return prevSheets.map((sheet) => {
                if (sheet.name === renamingSheetName) {
                  if (editorSelectedSheetName === sheet.name) {
                    setEditorSelectedSheetName(newName);
                  }
                  sheet.previousName = sheet.name;
                  sheet.name = newName;
                }
                return sheet;
              });
            });
          }
          setRenamingSheetName(null);
        }}
        onClosed={() => setRenamingSheetName(null)}
      />
      <div id="editorSection" style={{height: editorHeight}}>
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: projectWidth}}>
          <Project
            sheets={sheets}
            selectedSheetName={editorSelectedSheetName}
            onSheetAdded={(sheet) => addNewSheetCallback(sheet)}
            onAddingName={(sheet) => {
              editorRef.current!.addText(sheet.name);
              editorRef.current!.focus();
            }}
            onOpeningEditor={(sheet) => {
              setEditorSelectedSheetName(sheet.name);
            }}
            onOpeningResult={(sheet) => {
              sheetSectionRef.current!.open(sheet.name)
            }}
            onRenamingSheet={(name) => setRenamingSheetName(name)}
            onDeletingSheet={(name) => deleteSheetCallback(name)}
          />
        </div>
        <ResizeBar
          currentSize={projectWidth}
          onResizing={(initial, dx, dy) => {
            setProjectWidth(Math.min(window.innerWidth - 300, Math.max(dx + initial, 150)));
          }}
        >
          <div className="resize-bar" style={{left: projectWidth - 4}} />
        </ResizeBar>
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          top: 0,
          left: projectWidth,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Editor
            ref={editorRef}
            mode={editorMode}
            sheets={sheets}
            selectedSheetName={editorSelectedSheetName}
            onMakingNewQuery={() => makeNewQuery()}
            onRunningSql={runSql}
          />
        </div>
      </div>
      <div className="toolbarSection">
        <ResizeBar
          currentSize={editorHeight}
          onResizing={onEditorSheetResizing}
        >
          <div className="resize-bar" />
        </ResizeBar>
        <div className="inner" unselectable="on">
          <div className="left">
            {/*<div className="selector">*/}
            {/*  <MaybeTippy*/}
            {/*    theme="material"*/}
            {/*    interactive*/}
            {/*    content={*/}
            {/*      <span className="tooltip">*/}
            {/*        Charts cannot render more than 11,000 rows.*/}
            {/*      </span>*/}
            {/*    }*/}
            {/*    shown={!isChartEnabled(shownSheetInfo?.showCount)}*/}
            {/*  >*/}
            {/*    <div className={`select ${isChartEnabled(shownSheetInfo?.showCount) ? '' : 'disabled'}`}>*/}
            {/*      <select*/}
            {/*        value={presentationType}*/}
            {/*        onChange={(event) => {*/}
            {/*          setPresentationType(event.target.value as PresentationType);*/}
            {/*        }}*/}
            {/*        disabled={!isChartEnabled(shownSheetInfo?.showCount)}*/}
            {/*      >*/}
            {/*        {PresentationTypes.map((value) => {*/}
            {/*          return (*/}
            {/*            <option key={value} value={value}>{PresentationTypeLabel[value]}</option>*/}
            {/*          )*/}
            {/*        })}*/}
            {/*      </select>*/}
            {/*    </div>*/}
            {/*  </MaybeTippy>*/}
            {/*</div>*/}
            {shownSheetInfo && (
              <>
                {/*<span className="separator" />*/}
                <span className={`total ${blinkingShownSheetCount ? 'blinking' : ''}`}>
                  <i className="fas fa-table"></i>
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
                </span>
              </>
            )}
          </div>
          <div className="right">
            <Button
              onClick={() => exportCsv()}
              isLoading={isDownloadCsvLoading}
              disabled={sheets.length === 0}
              icon={<i className="fas fa-file-download" />}
            >
              Export sheet
              <span className="short-key">
                {ctrlCmdChar()} E
              </span>
            </Button>
          </div>
        </div>
        <ResizeBar
          currentSize={editorHeight}
          onResizing={onEditorSheetResizing}
        >
          <div className="resize-bar" />
        </ResizeBar>
      </div>
      <SheetSection
        ref={sheetSectionRef}
        sheets={sheets}
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
            if (!!prev && !!info && prev.name === info.name && prev.totalRowCount !== info.totalRowCount) {
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
        onRenamingSheet={(name) => setRenamingSheetName(name)}
        onSorting={(sheet, column, direction) => {
          sheet.isLoading = true;
          setSheets([...sheets]);
          sort(sheet, column, direction)
            .then((sheet) => {
              addNewSheetCallback(sheet);
            });
        }}
      />
    </div>
  );
}
