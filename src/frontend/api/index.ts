
import {ipcRenderer} from 'electron';

export function query(q: string): void {
  ipcRenderer.send('query', q);
}

export function addCsv(): void {
  ipcRenderer.send('add-csv');
}

export function reloadHtml(): void {
  ipcRenderer.send('reload-html');
}
