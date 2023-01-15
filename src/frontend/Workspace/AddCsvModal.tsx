import React from 'react';
import Modal from 'react-modal';
import './AddCsvModal.scss';
import {addCsv, convertFileList} from "../api";
import {Sheet} from "./types";
import {Format} from "../../types";
import path from 'path';
import {ctrlCmdChar} from "./constants";

type Status = 'draft' | 'loading' | 'added' | 'errored';

type File = {
  name: string,
  path: string,
  withHeader: boolean,
  format: Format,
  replace: string,
  status: Status
};

const MAX_LENGTH = 30;

function trimFilename(name: string): string {
  const length = MAX_LENGTH - 3;
  if (name.length <= length) {
    return name;
  }

  const half = length / 2;
  return `${name.substring(0, half)}...${name.substring(name.length - half, name.length)}`;
}

function FileItem({
  file,
  disabled,
  sheets,
  onWithHeaderChanged,
  onFormatChanged,
  onReplaceChanged,
  onDeleted
}: {
  file: File,
  sheets: Sheet[],
  disabled: boolean,
  onWithHeaderChanged: (newWithHeader: boolean) => void,
  onFormatChanged: (newFormat: Format) => void,
  onReplaceChanged: (newReplace: string) => void,
  onDeleted: () => void
}): JSX.Element {
  const [format, setFormat] = React.useState(file.format);
  const [replace, setReplace] = React.useState('');
  const [withHeader, setWithHeader] = React.useState(file.withHeader);

  let icon = <i className="fas fa-file draft icon" />;

  if (file.status === 'added') {
    icon = <i className="fas fa-check-square added icon" />;
  } else if (file.status === 'loading') {
    icon = <i className="spinner icon" />;
  } else if (file.status === 'errored') {
    icon = <i className="fas fa-exclamation-circle errored icon" />;
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
            <div className="select" style={{width: '110px'}}>
              <select
                value={`${withHeader}`}
                onChange={(event) => {
                  const newWithHeader = event.target.value == "true";
                  setWithHeader(newWithHeader);
                  onWithHeaderChanged(newWithHeader);
                }}
                disabled={disabled || format === "super"}
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
                  const newFormat = event.target.value as Format;
                  setFormat(newFormat);
                  onFormatChanged(newFormat);
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
              if (disabled) { return; }
              onDeleted();
            }}
          />
        </div>
        <div className="line">
          <div className="selector">
            <div className="select" style={{width: '215px'}}>
              <select
                value={replace}
                onChange={(event) => {
                  const replace = event.target.value;
                  setReplace(replace);
                  onReplaceChanged(replace);
                }}
                disabled={disabled || format === "super"}
              >
                <option value="" key="">as a new sheet</option>
                {sheets
                  .filter((s) => s.isCsv)
                  .map((s) => {
                    return (
                      <option
                        value={s.name}
                        key={s.name}
                      >
                        Replace {s.name}
                      </option>
                    );
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

export type Ref = {
  addFiles: (fileList: string[] | null) => void
}

export default React.forwardRef(function AddCsv({
  isOpen,
  sheets,
  onClose,
  onAdded
}: {
  isOpen: boolean,
  sheets: Sheet[],
  onClose: () => void,
  onAdded: (sheet: Sheet) => void
}, ref: React.ForwardedRef<Ref>): JSX.Element {
  const [files, setFiles] = React.useState<File[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => Modal.setAppElement('#app'), []);

  const uploadFiles = React.useCallback(async () => {
    if (files.length === 0) { return; }
    setIsLoading(true);

    for (let index=0;index<files.length;index++) {
      const file = files[index];
      setFiles((prevFiles) => {
        prevFiles[index] = {
          ...prevFiles[index],
          status: 'loading'
        };

        return [...prevFiles];
      });

      try {
        const sheets = await addCsv(file.path, file.withHeader, file.format, file.replace);
        if (sheets) {
          sheets.forEach((sheet) => {
            onAdded(sheet);
          })
        }

        setFiles((prevFiles) => {
          prevFiles[index] = {
            ...prevFiles[index],
            status: 'added'
          };

          return [...prevFiles];
        });
      } catch (e) {
        if (e instanceof Error) {
          alert(e.message);
        } else {
          alert(`Unknown error: ${e}`);
        }
        setFiles((prevFiles) => {
          prevFiles[index] = {
            ...prevFiles[index],
            status: 'errored'
          };

          return [...prevFiles];
        });
      }
    }

    setIsLoading(false);
    setFiles([]);
    onClose();
  }, [setIsLoading, onClose, onAdded, setFiles, files]);

  const addFilesCallback = React.useCallback((fileList: string[] | null) => {
    if (!fileList || isLoading) { return; }

    const newFiles: File[] = [];
    for (const file of fileList) {

      let format: Format = 'comma';
      const basename = path.basename(file);

      if (basename.endsWith('.tsv')) {
        format = 'tab';
      } else if (basename.endsWith('.psv')) {
        format = 'pipe';
      } else if (basename.endsWith('.super')) {
        format = 'super';
      }

      newFiles.push({
        name: trimFilename(basename),
        path: file,
        withHeader: true,
        format: format,
        replace: '',
        status: 'draft',
      });
    }

    if (fileRef.current) {
      fileRef.current.value = '';
    }

    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
  }, [setFiles, fileRef, isLoading]);

  React.useImperativeHandle(
    ref,
    () => ({
      addFiles: (fileList: string[] | null) => {
        addFilesCallback(fileList);
      }
    }),
    [addFilesCallback]
  );

  const close = React.useCallback(
    () => {
      setFiles([]);
      onClose();
    },
    [setFiles, onClose]
  )

  React.useEffect(() => {
    const handler = (event) => {
      if (!isOpen) { return; }

      if (event.code === 'Enter') {
        event.stopPropagation();
        uploadFiles();
        return;
      }

      if (event.code === 'Escape') {
        event.stopPropagation();
        close();
        return;
      }
    };
    document.addEventListener('keyup', handler);

    return () => {
      document.removeEventListener('keyup', handler) ;
    };
  }, [isOpen, uploadFiles]);

  React.useEffect(() => {
    const handler = (event) => {
      if (!isOpen) { return true; }

      if (event.code === 'KeyP' && (event.metaKey || event.ctrlKey)) {
        fileRef.current!.click();
        return false;
      }

      return true;
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler) ;
    };
  }, [isOpen, fileRef]);

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
          onClick={() => {fileRef.current!.click();}}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            onChange={(event) => addFilesCallback(convertFileList(event.target.files))}
            style={{width: '1px', height: '1px', position: 'absolute', opacity: 0}}
          />
          Drop files or click here to add files in order to add the list.
          <span className="short-key">
            {ctrlCmdChar} P
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
                  };

                  return [...prevFiles];
                })
              }}
              onFormatChanged={(newFormat) => {
                setFiles((prevFiles) => {
                  prevFiles[index] = {
                    ...prevFiles[index],
                    format: newFormat
                  };

                  return [...prevFiles];
                })
              }}
              onReplaceChanged={(newReplace) => {
                setFiles((prevFiles) => {
                  prevFiles[index] = {
                    ...prevFiles[index],
                    replace: newReplace
                  };

                  return [...prevFiles];
                })
              }}
              onDeleted={() => {
                setFiles((prevFiles) => prevFiles.filter((f, i) => i !== index))
              }}
              sheets={sheets}
            />;
          })}
        </div>
        <div className="cta-panel">
          <div className="left">
            <button
              className="main"
              disabled={isLoading || files.length === 0}
              onClick={() => uploadFiles()}
            >
              Import all files
              <span className="short-key">⏎</span>
            </button>
          </div>
          <div className="right">
            <button
              className="cancel"
              disabled={isLoading}
              onClick={() => {close();}}
            >
              Cancel
              <span className="short-key">ESC</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
});
