import React from "react";
import {Sheet as SheetType} from "./types";
import {rename} from "../api";
import {ctrlCmdChar} from "./constants";
import Modal from 'react-modal';

export default function RenameDialog({
  renamingSheet,
  onUpdated,
  onClosed
}: {
  renamingSheet: SheetType | null,
  onUpdated: (name: string) => void,
  onClosed: () => void
}): JSX.Element {
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
