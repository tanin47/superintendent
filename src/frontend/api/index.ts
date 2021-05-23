
import {ipcRenderer} from 'electron';

export function query(q: string): void {
  console.log(q);
  ipcRenderer.send('query', q);
  console.log('finish sending');
}
