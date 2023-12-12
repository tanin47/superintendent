import { app, BrowserWindow } from 'electron';
import Main from './main';

if (process.env.ENABLE_WDIO === 'yes') {
  require('wdio-electron-service/main');
  console.log('wdio-electron-service/main is loaded.');
}

Main.main(app, BrowserWindow);
