import React from 'react'
import Modal from 'react-modal'
import './AddCsvModal.scss'
import { addCsv, convertFileList } from '../api'
import { type Result, type Sheet } from './types'
import { type Format } from '../../types'
import { ctrlCmdChar } from './constants'
import { type ObjectWrapper, StateChangeApi, useDispatch } from './WorkspaceContext'
import * as dialog from './dialog'

type Status = 'draft' | 'loading' | 'added' | 'errored'

interface File {
  name: string
  path: string
  withHeader: boolean
  format: Format
  autoDetect: boolean
  replace: ObjectWrapper<Result> | null
  status: Status
}

const MAX_LENGTH = 30

function trimFilename (name: string): string {
  const length = MAX_LENGTH - 3
  if (name.length <= length) {
    return name
  }

  const half = length / 2
  return `${name.substring(0, half)}...${name.substring(name.length - half, name.length)}`
}

function FileItem ({
  file,
  disabled,
  csvs,
  onWithHeaderChanged,
  onFormatChanged,
  onReplaceChanged,
  onAutoDetectChanged,
  onDeleted
}: {
  file: File
  csvs: Array<ObjectWrapper<Result>>
  disabled: boolean
  onWithHeaderChanged: (newWithHeader: boolean) => void
  onFormatChanged: (newFormat: Format) => void
  onReplaceChanged: (newReplace: ObjectWrapper<Result> | null) => void
  onAutoDetectChanged: (newAutoDetect: boolean) => void
  onDeleted: () => void
}): JSX.Element {
  const [format, setFormat] = React.useState(file.format)
  const [autoDetect, setAutoDetect] = React.useState(file.autoDetect)
  const [replace, setReplace] = React.useState<ObjectWrapper<Result> | null>(null)
  const [withHeader, setWithHeader] = React.useState(file.withHeader)

  let icon = <i className="fas fa-file draft icon" />

  if (file.status === 'added') {
    icon = <i className="fas fa-check-square added icon" />
  } else if (file.status === 'loading') {
    icon = <i className="spinner icon" />
  } else if (file.status === 'errored') {
    icon = <i className="fas fa-exclamation-circle errored icon" />
  }

  return (
    <div className="file-item">
      <div className="left">
        {icon}
        {file.name}
      </div>

      <div className="right">
        <div className="line">
          <div className="selector">
            <div className="select">
              <select
                value={`${withHeader}`}
                onChange={(event) => {
                  const newWithHeader = event.target.value === 'true'
                  setWithHeader(newWithHeader)
                  onWithHeaderChanged(newWithHeader)
                }}
                disabled={disabled}
              >
                <option value="true">with header</option>
                <option value="false">without header</option>
              </select>
            </div>
          </div>
          <div className="selector">
            <div className="select">
              <select
                value={format}
                onChange={(event) => {
                  const newFormat = event.target.value as Format
                  setFormat(newFormat)
                  onFormatChanged(newFormat)
                }}
                disabled={disabled}
              >
                <option value="comma">Comma (,)</option>
                <option value="tab">Tab</option>
                <option value="pipe">Pipe (|)</option>
                <option value="semicolon">Semicolon (;)</option>
                <option value="colon">Colon (:)</option>
                <option value="tilde">Tilde (~)</option>
              </select>
            </div>
          </div>

          <i
            className={`fas fa-times ${disabled ? 'disabled' : ''}`}
            onClick={() => {
              if (disabled) { return }
              onDeleted()
            }}
          />
        </div>
        <div className="line">
          <div className="selector">
            <div className="select">
              <select
                value={autoDetect ? 'yes' : 'no'}
                onChange={(event) => {
                  const newAutoDetect = event.target.value === 'yes'
                  setAutoDetect(newAutoDetect)
                  onAutoDetectChanged(newAutoDetect)
                }}
                disabled={disabled}
              >
                <option value="yes">Auto-detect column types</option>
                <option value="no">Disable type auto-detection</option>
              </select>
            </div>
          </div>
          <div className="selector">
            <div className="select">
              <select
                value={replace?.base.id ?? ''}
                onChange={(event) => {
                  const replaceId = event.target.value
                  const replace = csvs.find((c) => c.base.id === replaceId) ?? null
                  setReplace(replace)
                  onReplaceChanged(replace)
                }}
                disabled={disabled}
                data-testid="add-csv-sheet-option"
              >
                <option value="" key="">as a new sheet</option>
                {csvs
                  .map((s) => {
                    return (
                      <option
                        value={s.base.id}
                        key={s.base.id}
                      >
                        Replace {s.base.name}
                      </option>
                    )
                  })
                }
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export interface Ref {
  addFiles: (fileList: string[] | null) => void
}

async function extractProblematicLine (message: string, file: string): Promise<string | null> {
  const matches = message.match(/line[^0-9]*([0-9]+)/i)

  if (!matches || matches.length < 1) { return null }

  const line = parseInt(matches[1])

  return await window.fileApi.extractContextualLines(file, line)
}

function mask (s: string | null): string | null {
  if (!s) { return null }

  // eslint-disable-next-line no-control-regex
  return s.replace(/[a-zA-Z]/gi, 'x').replace(/[0-9]/gi, '0').replace(/[^\x00-\x7F]/gi, 'u')
}

export default React.forwardRef(function AddCsv ({
  isOpen,
  csvs,
  onClose
}: {
  isOpen: boolean
  csvs: Array<ObjectWrapper<Result>>
  onClose: () => void
}, ref: React.ForwardedRef<Ref>): JSX.Element {
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const [files, setFiles] = React.useState<File[]>([])
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => Modal.setAppElement('#app'), [])

  const uploadFiles = React.useCallback(async () => {
    if (files.length === 0) { return }
    setIsLoading(true)

    for (let index = 0; index < files.length; index++) {
      const file = files[index]
      setFiles((prevFiles) => {
        prevFiles[index] = {
          ...prevFiles[index],
          status: 'loading'
        }

        return [...prevFiles]
      })

      try {
        const sheet = await addCsv(file.path, file.withHeader, file.format, file.replace?.base as Sheet, file.autoDetect)
        stateChangeApi.addOrReplaceResult(sheet)
        stateChangeApi.setSelectedResultId(sheet.id)

        setFiles((prevFiles) => {
          prevFiles[index] = {
            ...prevFiles[index],
            status: 'added'
          }

          return [...prevFiles]
        })
      } catch (e) {
        let message: string = ''
        if (e instanceof Error) {
          message = e.message
        } else if (typeof e === 'string') {
          message = e
        } else {
          // @ts-expect-error unknown type
          message = `Unknown error: ${e.toString()}`
        }

        const problematicLine = await extractProblematicLine(message, file.path)
        const headerLine = await window.fileApi.extractContextualLines(file.path, 1)

        const fileExtension = file.path.split('.').pop() ?? ''
        let postBody = ''

        if (fileExtension.toLocaleLowerCase() === 'super') {
          postBody = 'It seems you are trying to load a workspace file. Please use the menu "File > Load a workspace".'
        } else if (fileExtension.toLocaleLowerCase().startsWith('xls')) {
          postBody = 'It seems you are trying to load an Excel file, which is not supported. Please open it in Excel and export it into a CSV file. Then, you can add the CSV file.'
        } else if (file.autoDetect) {
          postBody = 'You can try disabling the column type auto-detection by selecting "Disable type auto-detection" when adding a CSV file.'
        }

        void dialog.showError(
          'Adding a CSV failed',
          message,
          {
            action: 'adding_csv_failed',
            extras: {
              fileExtension,
              withHeader: file.withHeader.toString(),
              format: file.format,
              autoDetect: file.autoDetect.toString(),
              problematicLine: mask(problematicLine) ?? '',
              headerLine: mask(headerLine) ?? ''
            }
          },
          `${postBody}\n\nPlease contact support@superintendent.app if you have an issue adding a CSV file.`.trim()
        )

        setFiles((prevFiles) => {
          prevFiles[index] = {
            ...prevFiles[index],
            status: 'errored'
          }

          return [...prevFiles]
        })
      }
    }

    setIsLoading(false)
    setFiles([])
    onClose()
  }, [files, onClose, stateChangeApi])

  const addFilesCallback = React.useCallback((fileList: string[] | null) => {
    if (fileList == null || fileList.length === 0 || isLoading) { return }

    const newFiles: File[] = []
    for (const file of fileList) {
      let format: Format = 'comma'
      const filename = file.split(/[\\/]/).pop() // get the filename

      if (filename === undefined) { continue }

      if (filename.endsWith('.tsv')) {
        format = 'tab'
      } else if (filename.endsWith('.psv')) {
        format = 'pipe'
      }

      newFiles.push({
        name: trimFilename(filename),
        path: file,
        withHeader: true,
        format,
        autoDetect: true,
        replace: null,
        status: 'draft'
      })
    }

    if (fileRef.current != null) {
      fileRef.current.value = ''
    }

    setFiles((prevFiles) => [...prevFiles, ...newFiles])
  }, [setFiles, fileRef, isLoading])

  React.useImperativeHandle(
    ref,
    () => ({
      addFiles: (fileList: string[] | null) => {
        addFilesCallback(fileList)
      }
    }),
    [addFilesCallback]
  )

  const close = React.useCallback(
    () => {
      setFiles([])
      onClose()
    },
    [setFiles, onClose]
  )

  React.useEffect(() => {
    const handler = (event): void => {
      if (!isOpen) { return }

      if (event.code === 'Enter') {
        event.stopPropagation()
        void uploadFiles()
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
  }, [close, isOpen, uploadFiles])

  React.useEffect(() => {
    const handler = (event): boolean => {
      if (!isOpen) { return true }

      if (event.code === 'KeyP' && (Boolean(event.metaKey) || Boolean(event.ctrlKey))) {
        fileRef.current!.click()
        return false
      }

      return true
    }
    document.addEventListener('keydown', handler)

    return () => {
      document.removeEventListener('keydown', handler)
    }
  }, [isOpen, fileRef])

  return (
    <Modal
      isOpen={isOpen}
      className="modal"
      overlayClassName="modal-overlay"
    >
      <div className="add-csv">
        <div className="header-panel">Add files</div>
        <div
          className="file-upload-panel"
          data-testid="file-upload-panel"
          onClick={() => { fileRef.current!.click() }}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            onChange={(event) => { addFilesCallback(convertFileList(event.target.files)) }}
            style={{ width: '1px', height: '1px', position: 'absolute', opacity: 0 }}
            data-testid="input-file"
          />
          Drop files or click here to add files in order to add the list.
          <span className="short-key">
            {ctrlCmdChar()} P
          </span>
        </div>
        <div className="file-list-panel">
          {files.map((file, index) => {
            return <FileItem
              key={index}
              file={file}
              disabled={isLoading}
              onWithHeaderChanged={(newWithHeader) => {
                setFiles((prevFiles) => {
                  prevFiles[index] = {
                    ...prevFiles[index],
                    withHeader: newWithHeader
                  }

                  return [...prevFiles]
                })
              }}
              onFormatChanged={(newFormat) => {
                setFiles((prevFiles) => {
                  prevFiles[index] = {
                    ...prevFiles[index],
                    format: newFormat
                  }

                  return [...prevFiles]
                })
              }}
              onReplaceChanged={(newReplace) => {
                setFiles((prevFiles) => {
                  prevFiles[index] = {
                    ...prevFiles[index],
                    replace: newReplace
                  }

                  return [...prevFiles]
                })
              }}
              onAutoDetectChanged={(newAutoDetect) => {
                setFiles((prevFiles) => {
                  prevFiles[index] = {
                    ...prevFiles[index],
                    autoDetect: newAutoDetect
                  }

                  return [...prevFiles]
                })
              }}
              onDeleted={() => {
                setFiles((prevFiles) => prevFiles.filter((f, i) => i !== index))
              }}
              csvs={csvs}
            />
          })}
        </div>
        <div className="cta-panel">
          <div className="left">
            <button
              className="main"
              disabled={isLoading || files.length === 0}
              onClick={() => { void uploadFiles() }}
              data-testid="import-all-files"
            >
              Import all files
              <span className="short-key">⏎</span>
            </button>
          </div>
          <div className="right">
            <button
              className="cancel"
              disabled={isLoading}
              onClick={() => { close() }}
            >
              Cancel
              <span className="short-key">ESC</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
})
