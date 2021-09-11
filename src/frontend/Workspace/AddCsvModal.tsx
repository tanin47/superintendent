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
  format: Format,
  status: Status
};

const MAX_LENGTH = 40;

function trimFilename(name: string): string {
  const length = MAX_LENGTH - 3;
  if (name.length <= length) {
    return name;
  }

  const half = length / 2;
  return `${name.substr(0, half)}...${name.substr(name.length - half + 1, half)}`;
}

function FileItem({
  file,
  disabled,
  onFormatChanged,
  onDeleted
}: {
  file: File,
  disabled: boolean,
  onFormatChanged: (newFormat: Format) => void,
  onDeleted: () => void
}): JSX.Element {
  const [format, setFormat] = React.useState(file.format);

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
              <option value="sqlite">Sqlite</option>
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
    </div>
  )
}

export type Ref = {
  addFiles: (fileList: string[] | null) => void
}

export default React.forwardRef(function AddCsv({
  isOpen,
  onClose,
  onAdded
}: {
  isOpen: boolean,
  onClose: () => void,
  onAdded: (sheet: Sheet) => void
}, ref: React.ForwardedRef<Ref>): JSX.Element {
  const [files, setFiles] = React.useState<File[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const fileRef = React.createRef<HTMLInputElement>();

  React.useEffect(() => Modal.setAppElement('#app'), []);

  const uploadFiles = React.useCallback(async () => {
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
        const sheets = await addCsv(file.path, file.format);
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
        alert(e.message);
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
      } else if (basename.endsWith('.db') || basename.endsWith('.sqlite')) {
        format = 'sqlite';
      }

      newFiles.push({
        name: trimFilename(basename),
        path: file,
        format: format,
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
              onFormatChanged={(newFormat) => {
                setFiles((prevFiles) => {
                  prevFiles[index] = {
                    ...prevFiles[index],
                    format: newFormat
                  };

                  return [...prevFiles];
                })
              }}
              onDeleted={() => {
                setFiles((prevFiles) => prevFiles.filter((f, i) => i !== index))
              }}
            />;
          })}
        </div>
        <div className="cta-panel">
          <div className="left">
            <button
              className="main"
              disabled={isLoading}
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
