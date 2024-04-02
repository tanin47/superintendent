import React from 'react'
import { type Sheet } from './types'
import { rename } from '../api'
import Modal from 'react-modal'
import { StateChangeApi, useDispatch } from './WorkspaceContext'

export default function RenameDialog ({
  renamingSheet,
  onClosed
}: {
  renamingSheet: Sheet | null
  onClosed: () => void
}): JSX.Element {
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const textInputRef = React.useRef<HTMLInputElement | null>(null)
  const [tableName, setTableName] = React.useState<string>('')
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  React.useEffect(
    () => {
      setTableName(renamingSheet ? renamingSheet.name : '')
    },
    [setTableName, renamingSheet]
  )

  React.useEffect(
    () => {
      if (renamingSheet) {
        setTimeout(
          () => {
            textInputRef.current?.select()
            textInputRef.current?.focus()
          },
          1
        )
      }
    },
    [renamingSheet]
  )

  const renameCallback = React.useCallback(
    () => {
      setErrorMsg(null) // Clear error message.
      if (!renamingSheet) return

      const sanitized = tableName.trim()

      if (sanitized === renamingSheet.name) {
        onClosed()
        return
      }

      rename(renamingSheet.name, sanitized)
        .then((result) => {
          stateChangeApi.rename(renamingSheet, sanitized)
          onClosed()
        })
        .catch((error) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          setErrorMsg(error.message)
        })
    },
    [renamingSheet, tableName, onClosed, stateChangeApi]
  )

  React.useEffect(() => {
    const handler = (event): void => {
      if (!renamingSheet) { return }

      if (event.code === 'Enter') {
        event.stopPropagation()
        renameCallback()
        return
      }

      if (event.code === 'Escape') {
        event.stopPropagation()
        onClosed()
      }
    }
    document.addEventListener('keyup', handler)

    return () => {
      document.removeEventListener('keyup', handler)
    }
  }, [renamingSheet, renameCallback, onClosed])

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
          ref={textInputRef}
          value={tableName}
          onChange={(event) => { setTableName(event.target.value) }}
          data-testid="rename-textbox"
        />
        <button
          className="main"
          onClick={() => { renameCallback() }}
          data-testid="rename-button"
        >
          Set new name
          <span className="short-key">⏎</span>
        </button>
        <button
          className="cancel"
          onClick={() => { onClosed() }}
          data-testid="cancel-rename-button"
        >
          Cancel
          <span className="short-key">ESC</span>
        </button>
      </div>
      {errorMsg !== null && (<div className="rename-error">Error: {errorMsg}</div>)}
    </Modal>
  )
}
