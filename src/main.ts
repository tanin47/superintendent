import {BrowserWindow, dialog, ipcMain} from 'electron';
import Store from 'electron-store';
import {Datastore} from "./data-store/Datastore";
import {DuckDb} from "./data-store/DuckDb";


export default class Main {
  static mainWindow: Electron.BrowserWindow;
  static application: Electron.App;
  static BrowserWindow;
  static db: Datastore;

  static evaluationMode: boolean = true;

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

    const result = await Main.db.addCsv(files[0]!, Main.evaluationMode);
    this.mainWindow.webContents.send('load-table-result', result);
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

    await Main.db.exportCsv(table, file);
    this.mainWindow.webContents.send('download-table-result', file);
  }

  private static async onReady(): Promise<void> {
    Store.initRenderer();

    Main.db = await DuckDb.create();

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
    const result = await Main.db.query(arg);

    event.reply(
      'query-result',
      {
        name: result.name,
        count: result.count,
        columns: result.columns,
        rows: result.rows
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
