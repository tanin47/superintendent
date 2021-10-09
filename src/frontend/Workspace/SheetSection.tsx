import React, {ReactElement} from 'react';
import {Sheet as SheetType} from "./types";
import Sheet from "./Sheet";
import Modal from 'react-modal';
import {rename} from "../api";
import './SheetSection.scss';
import {ctrlCmdChar} from "./constants";

let timer: NodeJS.Timeout;

function RenameDialog({renamingSheet, onUpdated, onClosed}: {renamingSheet: SheetType | null, onUpdated: (name: string) => void, onClosed: () => void}): JSX.Element {
  const [tableName, setTableName] = React.useState<string>('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(
    () => {
       setTableName(renamingSheet ? renamingSheet.name : '');
    },
    [setTableName, renamingSheet]
  )

  const renameCallback = React.useCallback(
    () => {
      setErrorMsg(null); // Clear error message.
      if (!renamingSheet) return;

      const sanitized = tableName.trim();

      if (sanitized == renamingSheet.name) {
        onClosed();
        return;
      }

      rename(renamingSheet.name, sanitized)
        .then((result) => {
          onUpdated(sanitized);
        })
        .catch((error) => {
          setErrorMsg(error.message);
        });
    },
    [renamingSheet, onClosed, setErrorMsg, tableName]
  );

  React.useEffect(() => {
    const handler = (event) => {
      if (!renamingSheet) { return; }

      if (event.code === 'Enter') {
        event.stopPropagation();
        renameCallback();
        return;
      }

      if (event.code === 'Escape') {
        event.stopPropagation();
        onClosed();
        return;
      }
    };
    document.addEventListener('keyup', handler);

    return () => {
      document.removeEventListener('keyup', handler) ;
    };
  }, [renamingSheet, renameCallback, onClosed]);

  return (
    <Modal
      isOpen={renamingSheet !== null}
      className="modal"
      overlayClassName="modal-overlay"
    >
      <div className="rename-form">
        <input
          type="text"
          className="rename-textbox"
          ref={(ref) => ref?.focus()} value={tableName}
          onChange={(event) => setTableName(event.target.value)}
        />
        <button
          className="main"
          onClick={() => renameCallback()}
        >
          Rename
          <span className="short-key">⏎</span>
        </button>
        <button
          className="cancel"
          onClick={() => onClosed()}
        >
          Cancel
          <span className="short-key">ESC</span>
        </button>
      </div>
      {errorMsg !== null && (<div className="rename-error">Error: {errorMsg}</div>)}
      <div className="rename-tip">
        Tip: you can use the shortcut <span className="short-key">{ctrlCmdChar} J</span> to rename a sheet.
      </div>
    </Modal>
  );
}

export default function SheetSection({
  sheets,
  selectedSheetIndex,
  onSheetRenamed,
  onSheetSelected,
  onSheetDeleted,
  onSheetRearranged
}: {
  sheets: Array<SheetType>,
  selectedSheetIndex: number,
  onSheetRenamed: (renamingSheetIndex: number, newName: string) => void,
  onSheetSelected: (selectedSheetIndex: number) => void,
  onSheetDeleted: (deletedSheetIndex: number) => void,
  onSheetRearranged: (movedSheetIndex: number, newIndex: number) => void,
}): ReactElement {

  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

  const onSingleClick = (index: number) => {
    onSheetSelected(index);
  }

  const [renamingSheetIndex, setRenamingSheetIndex] = React.useState<number | null>(null);
  const onDoubleClick = React.useCallback(
    (index: number) => {
      setRenamingSheetIndex(index);
    },
    [setRenamingSheetIndex]
  );

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>, index: number) => {
      clearTimeout(timer);
      if (event.detail === 1) {
        timer = setTimeout(() => onSingleClick(index), 200);
      } else if (event.detail >= 2) {
        onDoubleClick(index);
      }
    },
    [onDoubleClick]
  );

  React.useEffect(() => {
    const handler = (event) => {
      if (sheets.length === 0) { return; }
      if (event.code === 'KeyJ' && (event.metaKey || event.ctrlKey)) {
        onDoubleClick(selectedSheetIndex);
        return false;
      }

      return true;
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler) ;
    };
  }, [onDoubleClick, selectedSheetIndex, sheets]);

  return (
    <>
      <RenameDialog
        renamingSheet={renamingSheetIndex !== null ? sheets[renamingSheetIndex] : null}
        onUpdated={(name) => {
          if (renamingSheetIndex !== null) {
            onSheetRenamed(renamingSheetIndex, name);
          }
          setRenamingSheetIndex(null);
        }}
        onClosed={() => setRenamingSheetIndex(null)}
      />
      {sheets.length > 0 && (
        <Sheet
          sheet={sheets[Math.min(selectedSheetIndex, sheets.length - 1)]} />
      )}
      <div
        className="selector"
        onDragOver={(event) => {
          if (draggedIndex === null) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
        }}
        onDrop={(event) => {
          if (draggedIndex === null) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          onSheetRearranged(draggedIndex, sheets.length);
        }}
      >
        {sheets.map((sheet, index) => {
          return (
            <div
              key={`sheet${index}`}
              className={selectedSheetIndex === index ? 'selected' : ''}
              onClick={(event) => handleClick(event, index)}
              draggable={true}
              onDrag={(event) => {
                setDraggedIndex(index);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (draggedIndex === null) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
              }}
              onDrop={(event) => {
                if (draggedIndex === null) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();

                if (draggedIndex === index) { return; }
                onSheetRearranged(draggedIndex, index);
              }}
            >
              {sheet.name}
              <i
                  className="fas fa-times"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation(); // don't trigger selecting sheet.
                    onSheetDeleted(index)
                  }}/>
            </div>
          );
        })}
      </div>
    </>
  );
}
