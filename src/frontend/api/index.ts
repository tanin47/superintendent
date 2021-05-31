
import {ipcRenderer} from 'electron';
import {Sheet} from "../app/types";

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
