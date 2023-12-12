import {contextBridge, ipcRenderer, shell} from 'electron';
import Store from "electron-store";
import path, {PlatformPath} from "path";
import crypto from "crypto";

const store = new Store();

contextBridge.exposeInMainWorld( 'ipcRenderer', {
  invoke: ipcRenderer.invoke,
  on: ipcRenderer.on,
  removeListener: ipcRenderer.removeListener
});
contextBridge.exposeInMainWorld( 'Store', {
  get: (key: string) => store.get(key),
  set: (key: string, value: string) => store.set(key, value)
});
contextBridge.exposeInMainWorld( 'path', {
  basename: path.basename
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
  openExternal: shell.openExternal
});
contextBridge.exposeInMainWorld( 'util', {
  getPlatform: () => process.platform
});

declare global {
  interface Window {
    ipcRenderer: Electron.IpcRenderer;
    Store: {
      get: (key: string) => string | null | undefined,
      set: (key: string, value: string) => void,
    },
    path: PlatformPath,
    crypto2: {
      verify: (algorithm: string, input: string, publicKey: string, signature: string) => boolean
    },
    shell: any,
    util: {
      getPlatform: () => string
    }
  }
}
