import {BrowserWindow, dialog, ipcMain} from 'electron';
import Store from 'electron-store';
import {Datastore, Result} from "./data-store/Datastore";
import {Sqlite} from "./data-store/Sqlite";


export default class Main {
  static mainWindow: Electron.BrowserWindow;
  static application: Electron.App;
  static BrowserWindow;
  static db: Datastore;

  static evaluationMode: boolean = true;

  private static async addCsv(): Promise<Result | null> {
    const files = dialog.showOpenDialogSync(
      this.mainWindow,
      {
        properties: ['openFile'],
        filters: [{name: 'All files', extensions: ['*']}]
      }
    );

    if (!files || files.length === 0) {
      return null;
    }

    return Main.db.addCsv(files[0]!, Main.evaluationMode);
  }

  private static async downloadCsv(table: string): Promise<string | null> {
    const file = dialog.showSaveDialogSync(
      this.mainWindow,
      {
        defaultPath: `${table}.csv`,
        filters: [{name: 'All files', extensions: ['*']}]
      }
    );

    if (!file) {
      return null;
    }

    await Main.db.exportCsv(table, file);
    return file;
  }

  private static wrapResponse(resp: Promise<any>): Promise<any> {
    return resp
      .then((r) => ({
          success: true,
          data: r
      }))
      .catch((e) => ({success: false, message: e.message}));
  }

  private static async onReady(): Promise<void> {
    Store.initRenderer();

    Main.db = await Sqlite.create();

    ipcMain.handle('set-evaluation-mode', async (event, arg) => {
      Main.evaluationMode = !!arg;

      return true;
    });

    ipcMain.handle('query', async (event, arg) => {
      return Main.wrapResponse(Main.db.query(arg));
    });

    ipcMain.handle('add-csv', async () => {
      return Main.wrapResponse(Main.addCsv());
    });

    ipcMain.handle('download-csv', async (event, arg) => {
      return Main.wrapResponse(Main.downloadCsv(arg));
    });

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

  static main(app: Electron.App, browserWindow: typeof BrowserWindow): void {
    Main.BrowserWindow = browserWindow;
    Main.application = app;
    Main.application.on('window-all-closed', () => {
      Main.application.quit();
    });
    Main.application.on('ready', Main.onReady);
  }
}
