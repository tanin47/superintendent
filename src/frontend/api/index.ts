
import {ipcRenderer} from 'electron';
import {Sheet} from "../Workspace/types";
import axios from "axios";
import Store from "electron-store";
import crypto from 'crypto';
import {EditorMode} from "../../types";

const urlParams = new URLSearchParams(window.location.search);

export function getInitialEditorMode(): EditorMode {
  return (urlParams.get('editorMode') as EditorMode) || 'default';
}

export function getInitialFile(): string | null {
  return urlParams.get('initialFile');
}

export function convertFileList(fileList: FileList | null) {
  const results: string[] = [];

  if (fileList) {
    for (const file of fileList) {
      results.push(file.path);
    }
  }

  return results;
}

export type CheckIfLicenseIsValidResult = {
  success: boolean,
  errorMessage?: string | null
}

export function extractPublicKey(licenseKey: string): string | null {
  const publicKeyLines: Array<string> = [];
  let isPublicKeyLine = false;

  licenseKey.split('\n').forEach((line) => {
    if (line.startsWith('Key1:')) {
      isPublicKeyLine = true;
      return;
    }

    if (line.startsWith('---') && isPublicKeyLine) {
      isPublicKeyLine = false;
      return;
    }

    if (isPublicKeyLine) {
      publicKeyLines.push(line);
    }
  });

  if (publicKeyLines.length === 0) { return null; }

  return publicKeyLines.join('\n');
}

export function verifySignature(licenseKey: string, message: string, signature: string): boolean {
  const publicKey = extractPublicKey(licenseKey);

  if (!publicKey) { return false; }

  const cryptoPublicKey = crypto.createPublicKey('-----BEGIN PUBLIC KEY-----\n' + publicKey + '\n-----END PUBLIC KEY-----');

  return crypto.verify(
    'sha1',
    Buffer.from(message),
    cryptoPublicKey,
    Buffer.from(signature, 'base64')
  );
}

export function checkIfLicenseIsValid(licenseKey: string): Promise<CheckIfLicenseIsValidResult> {
  const message = `${new Date().getTime()}--${Math.random()}`;

  const defaultErrorMessage = 'The license key is not valid. Please contact support@superintendent.app.';
  const store = new Store();

  return new Promise<CheckIfLicenseIsValidResult>((resolve, reject) => {
    axios
      .post(
        `${process.env.SUPERINTENDENT_SERVER_BASE_URL}/api/check-license`,
        {
          key: licenseKey,
          message: message
        }
      )
      .then((resp) => {
        if (!resp.data.success) {
          resolve({
            success: false,
            errorMessage: resp.data.errors?.join('\n') || defaultErrorMessage
          });
          return;
        }

        if (!verifySignature(licenseKey, message, resp.data.signature)) {
          resolve({
            success: false,
            errorMessage: defaultErrorMessage
          });
          return;
        }

        store.set('license-key', licenseKey);

        resolve({success: true});
      })
      .catch(() => {
        resolve({
          success: false,
          errorMessage: defaultErrorMessage
        });
      })
  });
}

export function query(q: string): Promise<Sheet> {
  return ipcRenderer
    .invoke('query', q)
    .then((result) => {
      if (result.success) {
        return {
          presentationType: 'table',
          ...result.data
        };
      } else {
        throw result;
      }
    });
}

export function loadMore(table: string, offset: number): Promise<string[][]> {
  return ipcRenderer
    .invoke('load-more', table, offset)
    .then((result) => {
      if (result.success) {
        return result.data;
      } else {
        throw result;
      }
    });
}

export function addCsv(path: string, format: string): Promise<Sheet[] | null> {
  return ipcRenderer
    .invoke('add-csv', path, format)
    .then((result) => {
      if (result.success) {
        if (!result.data) {
          return null;
        } else {
          return result.data.map((item) => {
            return {
              presentationType: 'table',
              ...item
            };
          });
        }
      } else {
        throw result;
      }
    });
}

export function downloadCsv(table: string): Promise<string> {
  return ipcRenderer
    .invoke('download-csv', table)
    .then((result) => {
       if (result.success) {
          return result.data;
       } else {
          throw result;
       }
    });
}

export function drop(table: string): Promise<void> {
  return ipcRenderer
    .invoke('drop', table)
    .then((result) => {
      // don't care
    });
}

export function rename(previousTableName: string, newTableName: string): Promise<void> {
  return ipcRenderer
    .invoke('rename', previousTableName, newTableName)
    .then((result) => {
      if (result.success) {
        return;
      } else {
        throw result;
      }
    });
}
