import {BrowserWindow, Menu, MenuItem, dialog, ipcMain, shell} from 'electron';
import {Parser} from 'csv-parse';
import {Stringifier} from 'csv-stringify';
import fs from 'fs';
import path from 'path';
import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import defaultMenu from 'electron-default-menu';
import { MenuItemConstructorOptions } from 'electron/main';

export default class Main {
  static mainWindow: Electron.BrowserWindow;
  static application: Electron.App;
  static BrowserWindow;
  static db;

  static tables: Array<string> = [];
  static queryTableNameRunner: number = 0;

  private static onWindowAllClosed(): void {
    if (process.platform !== 'darwin') {
    }
  }

  private static getTableName(name: string, number: number | null = null): string {
    const candidate = name.replace(/[^a-zA-Z0-9_]/g, '_');
    return Main.getUniqueTableName(candidate);
  }

  private static getUniqueTableName(base: string, number: number | null = null): string {
    const candidate = base + (number ? `_${number}` : '');
    for (const table of Main.tables) {
      if (candidate === table) {
        return Main.getUniqueTableName(base, (number || 0) + 1);
      }
    }
    return candidate;
  }

  private static makeQueryTableName(): string {
    return Main.getTableName('query', Main.queryTableNameRunner + 1);
  }

  private static async addCsv(): Promise<void> {
    const files = dialog.showOpenDialogSync(
      this.mainWindow,
      {
        properties: ['openFile'],
        filters: [{name: 'All files', extensions: ['*']}]
      }
    );

    if (!files || files.length === 0) {
      this.mainWindow.webContents.send('load-table-result', null);
      return;
    }

    const stream = fs.createReadStream(files[0]!).pipe(new Parser({delimiter: ','}));
    const table = Main.getTableName(path.parse(files[0]!).name);

    let firstRow = true;
    const columns: Array<string> = [];

    for await (let row of stream)  {
      if (firstRow)  {
        row.forEach((r: string) => columns.push(r));
        await Main.db.exec(`CREATE TABLE "${table}" (${columns.map((c) => `"${c}" TEXT`).join(', ')})`);
        Main.tables.push(table);

        firstRow = false;
      } else {
        await Main.db.run(`INSERT INTO "${table}" (${columns.join(', ')}) VALUES (${columns.map((c) => '?').join(', ')})`, ...row);
      }
    }

    const rows = await Main.db.all(`SELECT * FROM "${table}"`);
    this.mainWindow.webContents.send('load-table-result', {name: table, columns, rows});
  }

  private static async downloadCsv(table: string): Promise<void> {
    const file = dialog.showSaveDialogSync(
      this.mainWindow,
      {
        defaultPath: `${table}.csv`,
        filters: [{name: 'All files', extensions: ['*']}]
      }
    );

    if (!file) {
      this.mainWindow.webContents.send('download-table-result', null);
      return;
    }

    const rows = await Main.db.all(`SELECT * FROM "${table}"`);

    let columns: Array<string> = [];
    if (rows.length > 0) {
      Object.keys(rows[0]).forEach((k) => columns.push(k))
    }

    const sink = fs.createWriteStream(file, {flags: 'w'});
    const stringifier = new Stringifier({delimiter: ','});
    const writer = stringifier.pipe(sink);

    stringifier.write(columns);
    for (const row of rows) {
      stringifier.write(columns.map((c) => row[c]));
    }
    stringifier.end();
    writer.end();
    this.mainWindow.webContents.send('download-table-result', file);
  }

  private static buildMenu(): void {
    const menu = defaultMenu(Main.application, shell);

    (menu[1].submenu as MenuItemConstructorOptions[]).splice(
      8,
      0,
      { type: 'separator' },
      {
        label: 'Editor mode',
        type: 'submenu',
        submenu: [
          {
            label: 'Normal',
            type: 'radio',
            checked: true,
            click: () => {
              Main.mainWindow.webContents.send('keymap-changed', 'default');
            }
          },
          {
            label: 'Vim',
            type: 'radio',
            checked: false,
            click: () => {
              Main.mainWindow.webContents.send('keymap-changed', 'vim');
            }
          },
        ]
      },
      { type: 'separator' }
    );
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
  }

  private static async onReady(): Promise<void> {
    Main.buildMenu();

    Main.db = await sqlite.open({
      filename: '/tmp/super.sqlite.db',
      driver: sqlite3.Database
    })
    await Main.db.exec('PRAGMA writable_schema = 1; \
      DELETE FROM sqlite_master; \
      PRAGMA writable_schema = 0; \
      VACUUM; \
      PRAGMA integrity_check;');
    await Main.db.exec("PRAGMA journal_mode = OFF;");

    ipcMain.on('query', async (event, arg) => {
      try {
        await Main.query(arg, event);
      } catch (err) {
        console.log(err);
        Main.mainWindow.webContents.send('query-error', {message: err.message})
      }
    })

    ipcMain.on('add-csv', async () => {
      try {
        await Main.addCsv();
      } catch (err) {
        console.log(err);
        Main.mainWindow.webContents.send('load-table-error', {message: err.message});
      }
    })

    ipcMain.on('download-csv', async (event, arg) => {
      try {
        await Main.downloadCsv(arg);
      } catch (err) {
        console.log(err);
        Main.mainWindow.webContents.send('load-table-error', {message: err.message});
      }
    })

    if (!Main.application.isPackaged) {
      ipcMain.on('reload-html', async () => {
        Main.mainWindow.reload();
        await Main.maybeEnableDev();
      })
    }

    Main.mainWindow = new Main.BrowserWindow({ width: 1280, height: 800, webPreferences: {nodeIntegration: true, contextIsolation: false}});

    await Main.mainWindow!.loadFile(`${__dirname}/index.html`, {query: {isPackaged: `${Main.application.isPackaged}`}});
    await Main.maybeEnableDev();
  }

  private static async maybeEnableDev(): Promise<void> {
    if (Main.application.isPackaged) { return; }
    Main.mainWindow!.webContents.openDevTools();
  }

  private static async query(arg, event: Electron.IpcMainEvent) {
    const table = Main.makeQueryTableName();
    await Main.db.run(`CREATE VIEW "${table}" AS ${arg}`);
    Main.tables.push(table);

    const rows = await Main.db.all(`SELECT * FROM "${table}"`);

    let columns: Array<string> = [];
    if (rows.length > 0) {
      Object.keys(rows[0]).forEach((k) => columns.push(k))
    }

    event.reply('query-result', {name: table, columns, rows});
  }

  static main(app: Electron.App, browserWindow: typeof BrowserWindow): void {
    Main.BrowserWindow = browserWindow;
    Main.application = app;
    Main.application.on('window-all-closed', () => {
      Main.application.quit();
    });
    Main.application.on('ready', Main.onReady);
  }
}
