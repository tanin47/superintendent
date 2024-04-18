import { contextBridge, ipcRenderer, shell } from 'electron'
import { cryptoApi, storeApi } from './external'

if (process.env.ENABLE_WDIO === 'yes') {
  require('wdio-electron-service/preload')
  console.log('wdio-electron-service/preload is loaded.')
}

contextBridge.exposeInMainWorld('ipcRenderer', {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  invoke: async (channel: string, ...args: any[]) => await ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const wrapped = (event: Electron.IpcRendererEvent, ...args: any[]): void => { listener(event, ...args) }
    ipcRenderer.on(channel, wrapped)

    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  }
})
contextBridge.exposeInMainWorld('storeApi', storeApi)
contextBridge.exposeInMainWorld('cryptoApi', cryptoApi)
contextBridge.exposeInMainWorld('shellApi', {
  openExternal: async (url: string) => { await shell.openExternal(url) }
})
contextBridge.exposeInMainWorld('miscApi', {
  getPlatform: () => process.platform,
  isWdioEnabled: () => process.env.ENABLE_WDIO === 'yes'
})

declare global {
  interface Window {
    ipcRenderer: {
      invoke: (channel: string, ...args: any[]) => Promise<any>
      on: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => () => void
    }
    storeApi: {
      get: (key: string) => any | null | undefined
      set: (key: string, value: any) => void
    }
    cryptoApi: {
      verify: (algorithm: string, input: string, publicKey: string, signature: string) => boolean
    }
    shellApi: {
      openExternal: (url: string) => void
    }
    miscApi: {
      getPlatform: () => string
      isWdioEnabled: () => boolean
    }
  }
}
