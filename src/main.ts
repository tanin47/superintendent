import {BrowserWindow, dialog, ipcMain, Menu, shell} from 'electron';
import {Parser} from 'csv-parse';
import {Stringifier} from 'csv-stringify';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import Store from 'electron-store';

const MAX_ROW = 1000;
const MAX_CHARACTERS = 160000;

class Batch {
  rowCount: number = 0;
  values: Array<string> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.rowCount = 0;
    this.values = [];
  }

  add(row: string[]) {
    for (const value of row) {
      this.values.push(value);
    }
    this.rowCount++;
  }
}


export default class Main {
  static mainWindow: Electron.BrowserWindow;
  static application: Electron.App;
  static BrowserWindow;
  static db;

  static tables: Array<string> = [];
  static queryTableNameRunner: number = 0;

  static evaluationMode: boolean = true;

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

  private static async addBatch(batch: Batch, table: string, columns: Array<string>): Promise<void> {
    const colLine = columns.map((c) => '?').join(', ');
    const values: string[] = [];

    for (let i=0;i<batch.rowCount;i++) {
      values.push(`(${colLine})`);
    }

    await Main.db.run(`INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(',')}) VALUES ${values.join(',')}`, batch.values);
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

    const stream = fs
      .createReadStream(files[0]!)
      .pipe(new Parser({
        bom: true,
        trim: true,
        delimiter: ',',
        skipEmptyLines: true
      }));
    const table = Main.getTableName(path.parse(files[0]!).name);

    let firstRow = true;
    const columns: Array<string> = [];
    let count = 0;

    let batch = new Batch();
    const maxBatchValues = 20000;

    for await (let row of stream)  {
      if (firstRow)  {
        row.forEach((r: string) => columns.push(r));
        await Main.db.exec(`CREATE TABLE "${table}" (${columns.map((c) => `"${c}" TEXT`).join(', ')})`);
        Main.tables.push(table);

        firstRow = false;
      } else {
        count++;

        if (batch.values.length < maxBatchValues) {
          if (row.length > columns.length) {
            row.splice(columns.length, row.length - columns.length);
          }

          batch.add(row);
        } else {
          await Main.addBatch(batch, table, columns);
          batch.reset();
        }
      }

      if (Main.evaluationMode) {
        if (count >= 100) { break; }
      }
    }

    if (batch.rowCount > 0) {
      await Main.addBatch(batch, table, columns);
      batch.reset();
    }

    const allRows = await Main.db.all(`SELECT * FROM "${table}" LIMIT ${MAX_ROW}`);
    const rows = Main.makePreview(columns, allRows);

    this.mainWindow.webContents.send('load-table-result', {name: table, count, hasMore: count > rows.length, columns, rows});
  }

  private static makePreview(columns: string[], rows: Array<{[col:string]: any}>): Array<{[col:string]: any}> {
    let numRows = 0;
    let numChars = 0;

    for (const row of rows) {
      for (const col of columns) {
        if (typeof row[col] === 'string') {
          numChars += row[col].length;
        } else {
          numChars += 3; // estimated for other fields
        }
      }

      numRows++;

      if (numChars > MAX_CHARACTERS) break;
      if (numRows > MAX_ROW) break;
    }

    return rows.slice(0, numRows);
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

  private static async onReady(): Promise<void> {
    Store.initRenderer();

    Main.db = await sqlite.open({
      filename: path.join(os.tmpdir(), `super.sqlite.${new Date().getTime()}.db`),
      driver: sqlite3.Database
    })
    await Main.db.exec('PRAGMA writable_schema = 1; \
      DELETE FROM sqlite_master; \
      PRAGMA writable_schema = 0; \
      VACUUM; \
      PRAGMA integrity_check;');
    await Main.db.exec("PRAGMA journal_mode = OFF;");
    await Main.db.exec("PRAGMA synchronous = OFF;");
    await Main.db.exec("PRAGMA locking_mode = EXCLUSIVE;");

    ipcMain.handle('set-evaluation-mode', async (event, arg) => {
      Main.evaluationMode = !!arg;

      return true;
    });

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

    if (!process.env.SUPERINTENDENT_IS_PROD) {
      ipcMain.on('reload-html', async () => {
        Main.mainWindow.reload();
        await Main.maybeEnableDev();
      })
    }

    Main.mainWindow = new Main.BrowserWindow({ width: 1280, height: 800, webPreferences: {nodeIntegration: true, contextIsolation: false}});

    await Main.mainWindow!.loadFile(`${__dirname}/index.html`);
    await Main.maybeEnableDev();
  }

  private static async maybeEnableDev(): Promise<void> {
    if (process.env.SUPERINTENDENT_IS_PROD) { return; }
    Main.mainWindow!.webContents.openDevTools();
  }

  private static async query(arg, event: Electron.IpcMainEvent) {
    const table = Main.makeQueryTableName();
    await Main.db.run(`CREATE VIEW "${table}" AS ${arg}`);
    Main.tables.push(table);

    const numOfRowsResult = await Main.db.all(`SELECT COUNT(*) AS number_of_rows FROM "${table}"`);
    const numOfRows = numOfRowsResult.length == 0 ? 0 : numOfRowsResult[0].number_of_rows;

    const allRows = await Main.db.all(`SELECT * FROM "${table}" LIMIT ${MAX_ROW}`);

    let columns: Array<string> = [];
    if (allRows.length > 0) {
      Object.keys(allRows[0]).forEach((k) => columns.push(k))
    }

    const rows = Main.makePreview(columns, allRows)

    event.reply(
      'query-result',
      {
        name: table,
        count: numOfRows,
        hasMore: numOfRows > rows.length,
        columns,
        rows
      });
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
