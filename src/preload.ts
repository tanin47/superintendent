import {contextBridge, ipcRenderer, shell} from 'electron';
import Store from "electron-store";
import {cryptoApi, storeApi} from "./external";


contextBridge.exposeInMainWorld( 'ipcRenderer', {
  invoke: (channel, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener)
});
contextBridge.exposeInMainWorld( 'storeApi', storeApi);
contextBridge.exposeInMainWorld( 'cryptoApi', cryptoApi);
contextBridge.exposeInMainWorld( 'shellApi', {
  openExternal: (url: string) =>  shell.openExternal(url)
});
contextBridge.exposeInMainWorld( 'miscApi', {
  getPlatform: () => process.platform,
  isWdioEnabled: () => process.env.ENABLE_WDIO === 'yes',
});

declare global {
  interface Window {
    ipcRenderer: {
      invoke: (channel: string, ...args: any[]) => Promise<any>,
      on: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => Electron.IpcRenderer,
      removeListener: (channel: string, listener: (...args: any[]) => void) => Electron.IpcRenderer
    },
    storeApi: {
      get: (key: string) => string | null | undefined,
      set: (key: string, value: string) => void,
    },
    cryptoApi: {
      verify: (algorithm: string, input: string, publicKey: string, signature: string) => boolean
    },
    shellApi: {
      openExternal: (url: string) => void,
    },
    miscApi: {
      getPlatform: () => string,
      isWdioEnabled: () => boolean
    }
  }
}

if (process.env.ENABLE_WDIO === 'yes') {
  require('wdio-electron-service/preload');
  console.log('wdio-electron-service/preload is loaded.');
}
