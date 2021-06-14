
import {ipcRenderer} from 'electron';
import {Sheet} from "../Workspace/types";
import axios from "axios";
import Store from "electron-store";
import crypto from 'crypto';

export type CheckIfLicenseIsValidResult = {
  success: boolean,
  errorMessage?: string | null
}

export function isProd(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('isPackaged') === 'true';
}

function extractPublicKey(licenseKey: string): string | null {
  const line = licenseKey.split('\n').find((line) => line.startsWith('Key0:'));

  if (!line) { return null; }

  const publicKey = line.split(' ')[1];

  if (!publicKey) { return null; }
  return publicKey;
}

function verifySignature(licenseKey: string, message: string, signature: string): boolean {
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
        'http://localhost:9000/api/check-license',
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
  ipcRenderer.send('query', q);

  const promise = new Promise<Sheet>((resolve, reject) => {
    ipcRenderer.once('query-result', (event, arg) => {
      resolve(arg);
    });
    ipcRenderer.once('query-error', (event, arg) => {
      reject(arg);
    });
  });

  return promise;
}

export function addCsv(): Promise<Sheet> {
  ipcRenderer.send('add-csv');

  const promise = new Promise<Sheet>((resolve, reject) => {
    ipcRenderer.once('load-table-result', (event, arg) => {
      resolve(arg);
    });
    ipcRenderer.once('load-table-error', (event, arg) => {
      reject(arg);
    });
  });

  return promise;
}

export function downloadCsv(table: string): Promise<string> {
  ipcRenderer.send('download-csv', table);

  const promise = new Promise<string>((resolve, reject) => {
    ipcRenderer.once('download-table-result', (event, arg) => {
      resolve(arg);
    });
    ipcRenderer.once('download-table-error', (event, arg) => {
      reject(arg);
    });
  });

  return promise;
}

export function reloadHtml(): void {
  ipcRenderer.send('reload-html');
}
