import React from 'react'
import Modal from 'react-modal'
import './AddCsvModal.scss'
import { addCsv, convertFileList, hasValidLicense } from '../api'
import { type Sheet } from './types'
import { type Format } from '../../types'
import { ctrlCmdChar } from './constants'
import { StateChangeApi, useDispatch } from './WorkspaceContext'
import { DateTime } from 'luxon'

type Status = 'draft' | 'loading' | 'added' | 'errored'

interface File {
  name: string
  path: string
  withHeader: boolean
  format: Format
  replace: Sheet | null
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
  onDeleted
}: {
  file: File
  csvs: Sheet[]
  disabled: boolean
  onWithHeaderChanged: (newWithHeader: boolean) => void
  onFormatChanged: (newFormat: Format) => void
  onReplaceChanged: (newReplace: Sheet | null) => void
  onDeleted: () => void
}): JSX.Element {
  const [format, setFormat] = React.useState(file.format)
  const [replace, setReplace] = React.useState<Sheet | null>(null)
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
            <div className="select" style={{ width: '110px' }}>
              <select
                value={`${withHeader}`}
                onChange={(event) => {
                  const newWithHeader = event.target.value === 'true'
                  setWithHeader(newWithHeader)
                  onWithHeaderChanged(newWithHeader)
                }}
                disabled={disabled || format === 'super'}
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
                <option value="super">Workflow</option>
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
            <div className="select" style={{ width: '215px' }}>
              <select
                value={replace?.id ?? ''}
                onChange={(event) => {
                  const replaceId = event.target.value
                  const replace = csvs.find((c) => c.id === replaceId) ?? null
                  setReplace(replace)
                  onReplaceChanged(replace)
                }}
                disabled={disabled || format === 'super'}
                data-testid="add-csv-sheet-option"
              >
                <option value="" key="">as a new sheet</option>
                {csvs
                  .filter((s) => s.isCsv)
                  .map((s) => {
                    return (
                      <option
                        value={s.id}
                        key={s.id}
                      >
                        Replace {s.name}
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

export default React.forwardRef(function AddCsv ({
  isOpen,
  csvs,
  onClose,
  onGoToLicense
}: {
  isOpen: boolean
  csvs: Sheet[]
  onClose: () => void
  onGoToLicense: () => void
}, ref: React.ForwardedRef<Ref>): JSX.Element {
  const licenseValidity = React.useMemo(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      isOpen
      return hasValidLicense(true)
    },
    [isOpen]
  )
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
        const sheet = await addCsv(file.path, file.withHeader, file.format, file.replace)
        stateChangeApi.addOrReplaceResult(sheet)
        stateChangeApi.setSelectedResult(sheet)

        setFiles((prevFiles) => {
          prevFiles[index] = {
            ...prevFiles[index],
            status: 'added'
          }

          return [...prevFiles]
        })
      } catch (e) {
        if (e instanceof Error) {
          alert(e.message)
        } else if (typeof e === 'string') {
          alert(e)
        } else {
          // @ts-expect-error unknown type
          alert(`Unknown error: ${e.toString()}`)
        }
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
      } else if (filename.endsWith('.super')) {
        format = 'super'
      }

      newFiles.push({
        name: trimFilename(filename),
        path: file,
        withHeader: true,
        format,
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
        {licenseValidity.state === 'valid'
          ? (
          <div className="license-notice paid">
            You are using the paid version. Your license will expire on {licenseValidity.expiredAt ? DateTime.fromJSDate(licenseValidity.expiredAt).toLocaleString(DateTime.DATE_MED) : '[unknown]'}
          </div>
            )
          : (
          <div className="license-notice free">
            <i className="fas fa-exclamation-circle"></i> You are using the free version that will only load the first 2,000 rows of CSV files.
            <br />
            <span className="click" onClick={() => { onGoToLicense() }}>Click here to buy a license</span>
          </div>
            )
        }
      </div>
    </Modal>
  )
})
