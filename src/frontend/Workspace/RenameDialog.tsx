import React from 'react'
import { type Sheet } from './types'
import { rename } from '../api'
import Modal from 'react-modal'
import { StateChangeApi, useDispatch } from './WorkspaceContext'

export interface RenameDialogInfo {
  sheet: Sheet
  isNewTable: boolean
}

export default function RenameDialog ({
  renamingInfo,
  onClosed
}: {
  renamingInfo: RenameDialogInfo | null
  onClosed: () => void
}): JSX.Element {
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const textInputRef = React.useRef<HTMLInputElement | null>(null)
  const [tableName, setTableName] = React.useState<string>('')
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  React.useEffect(
    () => {
      setTableName(renamingInfo ? renamingInfo.sheet.name : '')
    },
    [setTableName, renamingInfo]
  )

  React.useEffect(
    () => {
      if (renamingInfo) {
        setTimeout(
          () => {
            textInputRef.current?.select()
            textInputRef.current?.focus()
          },
          1
        )
      }
    },
    [renamingInfo]
  )

  const renameCallback = React.useCallback(
    () => {
      setErrorMsg(null) // Clear error message.
      if (!renamingInfo) return

      const sanitized = tableName.trim()

      if (sanitized === renamingInfo.sheet.name) {
        onClosed()
        return
      }

      rename(renamingInfo.sheet.name, sanitized)
        .then((result) => {
          stateChangeApi.rename(renamingInfo.sheet, sanitized)
          onClosed()
        })
        .catch((error) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          setErrorMsg(error.message)
        })
    },
    [renamingInfo, tableName, onClosed, stateChangeApi]
  )

  React.useEffect(() => {
    const handler = (event): void => {
      if (!renamingInfo) { return }

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
  }, [renameCallback, onClosed, renamingInfo])

  return (
    <Modal
      isOpen={renamingInfo !== null}
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
          Set name
          <span className="short-key">⏎</span>
        </button>
        {!renamingInfo?.isNewTable && <button
          className="cancel"
          onClick={() => { onClosed() }}
          data-testid="cancel-rename-button"
        >
          Cancel
          <span className="short-key">ESC</span>
        </button>}
      </div>
      {errorMsg !== null && (<div className="rename-error">Error: {errorMsg}</div>)}
    </Modal>
  )
}
