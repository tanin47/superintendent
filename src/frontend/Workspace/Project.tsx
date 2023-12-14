import './Project.scss';
import React from 'react';
import Button from "./Button";
import {ctrlCmdChar} from "./constants";
import AddCsv, {Ref as AddCsvRef} from "./AddCsvModal";
import {convertFileList, exportWorkflow, getInitialFile} from "../api";
import {Sheet} from "./types";
import RenameDialog from "./RenameDialog";
import {ExportedWorkflow, ExportWorkflowChannel} from "../../types";

export default function Project({
  sheets,
  selectedSheetName,
  onSheetAdded,
  onOpeningResult,
  onOpeningEditor,
  onAddingName,
  onRenamingSheet,
  onDeletingSheet,
}: {
  sheets: Array<Sheet>,
  selectedSheetName: string | null,
  onSheetAdded: (sheet: Sheet) => void,
  onOpeningResult: (sheet: Sheet) => void,
  onOpeningEditor: (sheet: Sheet) => void,
  onAddingName: (sheet: Sheet) => void,
  onRenamingSheet: (name: string) => void,
  onDeletingSheet: (name: string) => void,
}): JSX.Element {
  const [shouldOpenAddCsv, setShouldOpenAddCsv] = React.useState<boolean>(false);

  const addCsvRef = React.useRef<AddCsvRef>(null);
  const addFiles = React.useCallback((files: string[]) => {
    addCsvRef.current!.addFiles(files);
    setShouldOpenAddCsv(true);
  }, [addCsvRef]);
  const openAddCsvDialog = React.useCallback(
    () => {
      setShouldOpenAddCsv(true);
      },
    [setShouldOpenAddCsv]
  );

  React.useEffect(() => {
    const callback = async () => {
      const workflow: ExportedWorkflow = {nodes: []};

      sheets.forEach((sheet) => {
        workflow.nodes.push({
          name: sheet.name,
          sql: sheet.sql,
          isCsv: sheet.isCsv,
          dependsOn: sheet.dependsOn,
        })
      });

      await exportWorkflow(workflow);
    };
    window.ipcRenderer.on(ExportWorkflowChannel, callback);

    return () => {
      window.ipcRenderer.removeListener(ExportWorkflowChannel, callback) ;
    };
  }, [sheets]);

  React.useEffect(() => {
    const handler = (event) => {
      if (event.code === 'KeyP' && (event.metaKey || event.ctrlKey)) {
        openAddCsvDialog();
        return false;
      }

      return true;
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler) ;
    };
  }, [openAddCsvDialog]);

  const fileDroppedCallback = React.useCallback(
    (event) => {
      if (!event.dataTransfer?.files) {
        return;
      }

      if (event.dataTransfer.files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      addFiles(convertFileList(event.dataTransfer?.files));
    },
    [addFiles]
  );

  React.useEffect(
    () => {
      document.addEventListener('drop', fileDroppedCallback);

      return () => {
        document.removeEventListener('drop', fileDroppedCallback);
      };
    },
    [fileDroppedCallback]
  )

  const alreadyInitialized = React.useRef<boolean>(false);
  React.useEffect(
    () => {
      if (alreadyInitialized.current) { return; }
      if (!addCsvRef.current) { return; }

      const file = getInitialFile();

      if (!file) { return; }

      addFiles([file]);
      alreadyInitialized.current = true;
    },
    [addFiles]
  );

  React.useEffect(
    () => {
      const listener = (event: any, path: string) => {
        addFiles([path]);
      };
      window.ipcRenderer.on('open-file', listener);
      return () => {
        window.ipcRenderer.removeListener('open-file', listener);
      }
    },
    [addFiles]
  );


  return (
    <>
      <AddCsv
        ref={addCsvRef}
        isOpen={shouldOpenAddCsv}
        sheets={sheets}
        onClose={() => setShouldOpenAddCsv(false)}
        onAdded={(sheet) => onSheetAdded(sheet)}
      />
      <div className="toolbarSection top">
        <div className="inner">
          <Button
            onClick={() => openAddCsvDialog()}
            icon={<i className="fas fa-file-upload"/>}
            testId="add-files"
          >
            Add files
            <span className="short-key">
              {ctrlCmdChar()} P
            </span>
          </Button>
        </div>
      </div>
      <div className="project-panel">
        <div className="body">
          {sheets.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())).map((sheet) => {
            const icon = sheet.isCsv ? (
              <i className="fas fa-file-csv"></i>
            ) : (
              <i className="fas fa-caret-square-right"></i>
            );

            return (
              <div
                key={sheet.name}
                className={`item ${sheet.name === selectedSheetName ? 'selected' : ''}`}
                onClick={() => {
                  onOpeningEditor(sheet)
                }}
              >
                {icon}
                <span>{sheet.name}</span>
                <i
                  className="fas fa-search hover-icon"
                  onClick={(event) => {
                    onOpeningResult(sheet);
                    event.stopPropagation();
                  }}
                ></i>
                <i
                  className="fas fa-quote-left hover-icon"
                  onClick={(event) => {
                    onAddingName(sheet);
                    event.stopPropagation();
                  }}
                ></i>
                <i
                  className="fas fa-font hover-icon"
                  onClick={(event) => {
                    onRenamingSheet(sheet.name);
                    event.stopPropagation();
                  }}
                ></i>
                <i
                  className="fas fa-trash-alt hover-icon"
                  onClick={(event) => {
                    onDeletingSheet(sheet.name);
                    event.stopPropagation();
                  }}
                ></i>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
