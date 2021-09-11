import React, {ReactElement} from 'react';
import {Sheet as SheetType} from "./types";
import Sheet from "./Sheet";
import Modal from 'react-modal';
import {rename} from "../api";
import './SheetSection.scss';

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
    (newName) => {
      setErrorMsg(null); // Clear error message.
      if (!renamingSheet) return;

      const sanitized = newName.trim();

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
    [renamingSheet, onClosed, setErrorMsg]
  );

  return (
    <Modal
      isOpen={renamingSheet !== null}
      className="modal"
      overlayClassName="modal-overlay"
    >
      <div>
        <input
          type="text"
          className="rename-textbox"
          ref={(ref) => ref?.focus()} value={tableName}
          onChange={(event) => setTableName(event.target.value)}
        />
        <button
          className="main"
          onClick={() => renameCallback(tableName.trim())}
        >Rename</button>
      </div>
      {errorMsg !== null && (<div className="rename-error">Error: {errorMsg}</div>)}
    </Modal>
  );
}

export default function SheetSection({
  evaluationMode,
  sheets,
  selectedSheetIndex,
  onSheetRenamed,
  onSheetSelected,
  onSheetDeleted
}: {
  evaluationMode: boolean,
  sheets: Array<SheetType>,
  selectedSheetIndex: number,
  onSheetRenamed: (renamingSheetIndex: number, newName: string) => void,
  onSheetSelected: (selectedSheetIndex: number) => void
  onSheetDeleted: (deletedSheetIndex: number) => void
}): ReactElement {

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
          evaluationMode={evaluationMode}
          sheet={sheets[Math.min(selectedSheetIndex, sheets.length - 1)]} />
      )}
      <div className="selector">
        {sheets.map((sheet, index) => {
          return (
            <div
                key={`sheet${index}`}
                className={selectedSheetIndex === index ? 'selected' : ''}
                onClick={(event) => handleClick(event, index)}>
              {sheet.name}
              <i
                  className="fas fa-times"
                  onClick={() => onSheetDeleted(index)}/>
            </div>
          );
        })}
      </div>
    </>
  );
}
