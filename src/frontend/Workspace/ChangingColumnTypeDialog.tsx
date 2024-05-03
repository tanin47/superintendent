import React from 'react'
import Modal from 'react-modal'
import './ChangingColumnTypeDialog.scss'
import { type Result, type Column } from './types'
import { type ColumnType, ColumnTypes } from '../../types'
import { changeColumnType } from '../api'
import Button from './Button'
import { StateChangeApi, useDispatch } from './WorkspaceContext'
import * as dialog from './dialog'

export interface ChangingColumnInfo {
  result: Result
  column: Column
}

export function ChangingColumnTypeDialog ({
  info,
  onClosing
}: {
  info: ChangingColumnInfo | null
  onClosing: () => void
}): JSX.Element {
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [tpe, setTpe] = React.useState<ColumnType | ''>('')
  const [timestampFormat, setTimestampFormat] = React.useState<string>('%-d-%b-%Y')
  const [error, setError] = React.useState<string | null>(null)

  const close = React.useCallback(
    () => {
      setError('')
      onClosing()
    },
    [onClosing]
  )

  const change = React.useCallback(
    async () => {
      setError('')

      if (tpe === '') {
        setError('You must select a new type.')
        return
      }

      if (tpe === 'timestamp' && timestampFormat === '') {
        setError('The timestamp format is required.')
        return
      }

      setIsLoading(true)

      try {
        const sheet = await changeColumnType(
          info!.result,
          info!.column.name,
          tpe,
          timestampFormat
        )

        stateChangeApi.addOrReplaceResult(sheet)

        close()
      } catch (unknownError) {
        const error = unknownError as any
        let message = 'Unknown error occurred.'

        if (typeof error === 'string') {
          message = error
        } else if (error instanceof Object && 'message' in error) {
          message = error.message
        } else {
          console.log(error)
        }

        let postBody: string | null = null

        // The error is about parsing a date.
        if (tpe === 'timestamp') {
          postBody = 'It looks like you are having an issue with date parsing. Please review <span class="link" onclick="window.shellApi.openExternal(\'https://duckdb.org/docs/sql/functions/dateformat.html\')">the strptime documentation</span> for accurate date parsing instruction.\n\nIf you need help, contact support@superintendent.app.'
        }

        void dialog.showError(
          'Changing column type failed',
          message,
          {
            action: 'changing_column_type_failed',
            extras: {
              columnName: info!.column.name,
              tpe,
              timestmapFormat: timestampFormat
            }
          },
          postBody
        )
      } finally {
        setIsLoading(false)
      }
    },
    [tpe, timestampFormat, info, stateChangeApi, close]
  )

  React.useEffect(
    () => {
      if (!info) { return }
      setTpe('')
    },
    [info]
  )

  React.useEffect(() => {
    const handler = (event): void => {
      if (!info) { return }

      if (event.code === 'Enter') {
        event.stopPropagation()
        void change()
        return
      }

      if (event.code === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener('keyup', handler)

    return () => {
      document.removeEventListener('keyup', handler)
    }
  }, [close, info, change])

  if (!info) { return <></> }

  return (
    <Modal
      isOpen={true}
      className="modal"
      overlayClassName="modal-overlay"
    >
      <div className="changing-column-type-dialog">
        <div className="header-panel">Change column type</div>
        <div className="body">
          <div className="current-name">
            <span className="label">Name:</span> <span className="value">{info.column.name}</span>
          </div>
          <div className="current-type">
            <span className="label">Type:</span> <span className="value">{info.column.tpe.toLocaleUpperCase()}</span>
          </div>
          <div className="new-column">
            <span className="label">New type:</span>
            <span className="value">
              <div className="selector">
                <div className="select" style={{ width: '150px' }}>
                  <select data-testid="new-type-selectbox" value={tpe} onChange={(event) => { setTpe(event.target.value) }}>
                    <option value="">Select the new type</option>
                    {ColumnTypes.map((columnType) => {
                      return (
                        <option value={columnType} key={columnType}>{columnType.toLocaleUpperCase()}</option>
                      )
                    })}
                  </select>
                </div>
              </div>
              {tpe === 'timestamp' && (
                <div className="timestamp-format">
                  <input type="text" data-testid="timestamp-format-textbox" value={timestampFormat} onChange={(event) => { setTimestampFormat(event.target.value) }} />
                </div>
              )}
            </span>
          </div>
          {tpe === 'timestamp' && (
            <div className="remark">
              <div>
                Please refer to <span className="link" onClick={() => { window.shellApi.openExternal('https://duckdb.org/docs/sql/functions/dateformat.html') }}>the strptime documentation</span> for accurate date parsing instruction.
              </div>
            </div>
          )}
          {error && (
            <div className="error" data-testid="error">
              {error}
            </div>
          )}
        </div>
        <div className="cta-panel">
          <div className="left">
            <Button
              className="main"
              isLoading={isLoading}
              onClick={() => { void change() }}
              testId="change-button"
            >
              Change
              <span className="short-key">⏎</span>
            </Button>
          </div>
          <div className="right">
            <button
              className="cancel"
              disabled={isLoading}
              onClick={() => { close() }}
              data-testid="cancel-button"
            >
              Cancel
              <span className="short-key">ESC</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
