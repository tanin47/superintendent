import {BrowserWindow, Menu, dialog, ipcMain} from 'electron';
import {Parser} from 'csv-parse';
import fs from 'fs';
import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';

export default class Main {
  static mainWindow: Electron.BrowserWindow;
  static application: Electron.App;
  static BrowserWindow;
  static db;
  private static onWindowAllClosed(): void {
    if (process.platform !== 'darwin') {
      Main.application.quit();
    }
  }

  static async handleOpenFileDialog(): Promise<void> {
    const files = dialog.showOpenDialogSync(
      this.mainWindow,
      {
        properties: ['openFile'],
        filters: [{name: 'All files', extensions: ['*']}]
      }
    );

    if (!files || files.length === 0) { return; }

    const stream = fs.createReadStream(files[0]!).pipe(new Parser({delimiter: ','}));

    let firstRow = true;
    const columns: Array<string> = [];

    for await (let row of stream)  {
      if (firstRow)  {
        row.forEach((r: string) => columns.push(r));
        await Main.db.exec(`CREATE TABLE test_csv (${columns.map((c) => `"${c}" TEXT`).join(', ')})`);

        firstRow = false;
      } else {
        await Main.db.run(`INSERT INTO test_csv (${columns.join(', ')}) VALUES (${columns.map((c) => '?').join(', ')})`, ...row);
      }
    }

    const rows = await Main.db.all('SELECT * FROM test_csv');
    this.mainWindow.webContents.send('result', {columns, rows});
  }

  private static async onReady(): Promise<void> {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: 'Super',
        submenu: [
          {role: 'about'}
        ]
      },
      {
        label: 'File',
        submenu: [
          {
            label: 'Open file...',
            click: () => Main.handleOpenFileDialog()
          }
        ]
      }
    ]))

    Main.db = await sqlite.open({
      filename: 'super.sqlite.db',
      driver: sqlite3.Database
    })
    await Main.db.exec('PRAGMA writable_schema = 1; \
      DELETE FROM sqlite_master; \
      PRAGMA writable_schema = 0; \
      VACUUM; \
      PRAGMA integrity_check;');
    await Main.db.exec("PRAGMA journal_mode = OFF;");

    ipcMain.on('query', async (event, arg) => {
      const rows = await Main.db.all(arg);

      let columns: Array<string> = [];
      if (rows.length > 0) {
        Object.keys(rows[0]).forEach((k) => columns.push(k))
      }

      event.reply('result', {columns, rows});
    })

    Main.mainWindow = new Main.BrowserWindow({ width: 800, height: 600, webPreferences: {nodeIntegration: true, contextIsolation: false}});
    await Main.mainWindow!.loadFile(__dirname + '/index.html');
    Main.mainWindow!.webContents.openDevTools()
  }

  static main(app: Electron.App, browserWindow: typeof BrowserWindow): void {
    Main.BrowserWindow = browserWindow;
    Main.application = app;
    Main.application.on('window-all-closed', Main.onWindowAllClosed);
    Main.application.on('ready', Main.onReady);
  }
}
