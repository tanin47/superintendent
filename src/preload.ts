import { contextBridge, ipcRenderer, shell, webUtils } from 'electron'
import { cryptoApi, storeApi } from './external'
import fs from 'fs'
import readline from 'readline'

if (process.env.ENABLE_WDIO === 'yes') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('wdio-electron-service/preload')
  console.log('wdio-electron-service/preload is loaded.')
}

contextBridge.exposeInMainWorld('ipcRenderer', {
   
  invoke: async (channel: string, ...args: any[]) => await ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
     
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

contextBridge.exposeInMainWorld('fileApi', {
  extractContextualLines: async (file: string, middleLineNumber: number): Promise<string | null> => {
    if (middleLineNumber >= 3000000) { return await Promise.resolve(null) }

    const rl = readline.createInterface({
      input: fs.createReadStream(file),
      crlfDelay: Infinity
    })

    const lines: string[] = []

    let currentLine = 1
    for await (const line of rl) {
      if ((middleLineNumber - 2) <= currentLine && currentLine <= (middleLineNumber + 2)) {
        lines.push(line.slice(0, 1000))
      }
      currentLine += 1
    }

    return lines.join('\n')
  }
})

contextBridge.exposeInMainWorld('webUtils', {
  getPathForFile: (file: File): string => {
    return webUtils.getPathForFile(file)
  }
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
      sign: (algorithm: string, input: string, privateKey: string) => string
    }
    shellApi: {
      openExternal: (url: string) => void
    }
    miscApi: {
      getPlatform: () => string
      isWdioEnabled: () => boolean
    }
    fileApi: {
      extractContextualLines: (file: string, middleLineNumber: number) => Promise<string | null>
    }
    webUtils: {
      getPathForFile: (file: File) => string
    }
  }
}
