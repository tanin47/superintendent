import {contextBridge, ipcRenderer, shell} from 'electron';
import Store from "electron-store";
import crypto from "crypto";

const store = new Store();

contextBridge.exposeInMainWorld( 'ipcRenderer', {
  invoke: (channel, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener)
});
contextBridge.exposeInMainWorld( 'Store', {
  get: (key: string) => store.get(key),
  set: (key: string, value: string) => store.set(key, value)
});
contextBridge.exposeInMainWorld( 'crypto2', {
  verify: (algorithm: string, input: string, publicKey: string, signature: string) => crypto.verify(
    algorithm,
    Buffer.from(input),
    crypto.createPublicKey(publicKey),
    Buffer.from(signature, 'base64')
  )
});
contextBridge.exposeInMainWorld( 'shell', {
  openExternal: (url: string) =>  shell.openExternal(url)
});
contextBridge.exposeInMainWorld( 'util', {
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
    Store: {
      get: (key: string) => string | null | undefined,
      set: (key: string, value: string) => void,
    },
    path: {
      basename: (filename: string) => string,
    },
    crypto2: {
      verify: (algorithm: string, input: string, publicKey: string, signature: string) => boolean
    },
    shell: {
      openExternal: (url: string) => void,
    },
    util: {
      getPlatform: () => string,
      isWdioEnabled: () => boolean
    }
  }
}

if (process.env.ENABLE_WDIO === 'yes') {
  require('wdio-electron-service/preload');
  console.log('wdio-electron-service/preload is loaded.');
}
