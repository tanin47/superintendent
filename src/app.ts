import { app, BrowserWindow } from 'electron'
import Main from './main'

if (process.env.ENABLE_WDIO === 'yes') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('wdio-electron-service/main')
  console.log('wdio-electron-service/main is loaded.')
}

Main.main(app, BrowserWindow)
