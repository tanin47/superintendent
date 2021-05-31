import {BrowserWindow, Menu, dialog, ipcMain} from 'electron';
import {Parser} from 'csv-parse';
import fs from 'fs';
import path from 'path';
import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';

export default class Main {
  static mainWindow: Electron.BrowserWindow;
  static application: Electron.App;
  static BrowserWindow;
  static db;

  static tables: Array<string> = [];
  static queryTableNameRunner: number = 0;

  private static onWindowAllClosed(): void {
    if (process.platform !== 'darwin') {
      Main.application.quit();
    }
  }

  static getTableName(name: string, number: number | null = null): string {
    const candidate = name.replace(/[^a-zA-Z0-9_]/g, '_');
    return Main.getUniqueTableName(candidate);
  }

  static getUniqueTableName(base: string, number: number | null = null): string {
    const candidate = base + (number ? `_${number}` : '');
    for (const table of Main.tables) {
      if (candidate === table) {
        return Main.getUniqueTableName(base, (number || 0) + 1);
      }
    }
    return candidate;
  }

  static makeQueryTableName(): string {
    const table = Main.getTableName('query', Main.queryTableNameRunner + 1);
    Main.tables.push(table);
    return table;
  }

  static async addCsv(): Promise<void> {
    const files = dialog.showOpenDialogSync(
      this.mainWindow,
      {
        properties: ['openFile'],
        filters: [{name: 'All files', extensions: ['*']}]
      }
    );

    if (!files || files.length === 0) { return; }

    const stream = fs.createReadStream(files[0]!).pipe(new Parser({delimiter: ','}));

    const table = Main.getTableName(path.parse(files[0]!).name);
    Main.tables.push(table);

    let firstRow = true;
    const columns: Array<string> = [];

    for await (let row of stream)  {
      if (firstRow)  {
        row.forEach((r: string) => columns.push(r));
        await Main.db.exec(`CREATE TABLE "${table}" (${columns.map((c) => `"${c}" TEXT`).join(', ')})`);

        firstRow = false;
      } else {
        await Main.db.run(`INSERT INTO "${table}" (${columns.join(', ')}) VALUES (${columns.map((c) => '?').join(', ')})`, ...row);
      }
    }

    const rows = await Main.db.all(`SELECT * FROM "${table}"`);
    this.mainWindow.webContents.send('load-table-result', {name: table, columns, rows});
  }

  private static async onReady(): Promise<void> {
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
      const table = Main.makeQueryTableName();
      await Main.db.run(`CREATE VIEW "${table}" AS ${arg}`);

      const rows = await Main.db.all(`SELECT * FROM "${table}"`);

      let columns: Array<string> = [];
      if (rows.length > 0) {
        Object.keys(rows[0]).forEach((k) => columns.push(k))
      }

      event.reply('query-result', {name: table, columns, rows});
    })

    ipcMain.on('add-csv', async () => {
      await Main.addCsv();
    })

    ipcMain.on('reload-html', async () => {
      Main.mainWindow.reload();
    })

    Main.mainWindow = new Main.BrowserWindow({ width: 1280, height: 800, webPreferences: {nodeIntegration: true, contextIsolation: false}});
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
