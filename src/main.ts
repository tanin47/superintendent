import {BrowserWindow, dialog, ipcMain, Menu, clipboard} from 'electron';
import Store from 'electron-store';
import {Datastore} from "./data-store/Datastore";
import {Workerize} from "./data-store/Workerize";
import {
  EditorMode,
  EditorModeChannel,
  ExportedWorkflow,
  ExportWorkflowChannel,
  Format,
  ImportWorkflowChannel
} from "./types";
import {getRandomBird} from "./data-store/Birds";
import fs from "fs";

export default class Main {
  static mainWindow: Electron.BrowserWindow;
  static application: Electron.App;
  static BrowserWindow;
  static db: Datastore;
  static store: Store;
  static initialFile: string | null = null;

  static evaluationMode: boolean = true;

  private static isMac(): boolean {
    return process.platform === 'darwin';
  }

  private static isWin(): boolean {
    return process.platform === 'win32';
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

  private static async exportSchema(): Promise<void> {
    const file = dialog.showSaveDialogSync(
      this.mainWindow,
      {
        defaultPath: `schema.sql`,
        filters: [{name: 'All files', extensions: ['*']}]
      }
    );

    if (!file) {
      return;
    }

    await Main.db.exportSchema(file);
  }

  private static async importWorkflow(): Promise<void> {
    const files = dialog.showOpenDialogSync(
      this.mainWindow,
      {
        filters: [{name: 'Superintendent', extensions: ['*.super']}]
      }
    );

    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];

    const data = fs.readFileSync(file, {encoding: 'utf8', flag: 'r'});

    Main.mainWindow!.webContents.send(ImportWorkflowChannel, JSON.parse(data));
  }

  private static async initExportWorkflow(): Promise<void> {
    Main.mainWindow!.webContents.send(ExportWorkflowChannel, 'abracadabra');
  }

  private static async exportWorkflow(workflow: ExportedWorkflow): Promise<string> {
    const file = dialog.showSaveDialogSync(
      this.mainWindow,
      {
        defaultPath: `workflow_${getRandomBird()}.super`,
        filters: [{name: 'All files', extensions: ['*']}]
      }
    );

    if (!file) {
      return Promise.resolve("exit");
    }

    const writer = fs.createWriteStream(file, {flags: 'w'});

    writer.write(JSON.stringify(workflow, null, 2));
    writer.close();

    return Promise.resolve("i will create as I speak");
  }

  private static wrapResponse(resp: Promise<any>): Promise<any> {
    return resp
      .then((r) => ({
          success: true,
          data: r
      }))
      .catch((e) => {
        console.log(e);

        return {success: false, message: e.message};
      });
  }

  private static getEditorMode(): EditorMode {
    return (Main.store.get('editorMode') as (EditorMode | null)) || 'default';
  }

  private static buildMenu(): void {
    const devViewSubmenu = [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
    ];

    const setEditorMode = (mode: EditorMode) => {
      Main.store.set('editorMode', mode);
      Main.mainWindow!.webContents.send(EditorModeChannel, mode);
    };

    const template = [
      ...(Main.isMac() ? [{
        label: 'Superintendent',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideothers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }] : []),
      {
        label: 'File',
        submenu: [
          {
            label: 'Save workflow',
            accelerator: process.platform === 'darwin' ? 'Cmd+S' : 'Ctrl+S',
            click: () => {
              Main.initExportWorkflow();
            }
          },
          {
            label: 'Load workflow' ,
            accelerator: process.platform === 'darwin' ? 'Cmd+L' : 'Ctrl+L',
            click: () => {
              Main.importWorkflow();
            }
          },
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          ...(Main.isMac() ? [
            { role: 'pasteAndMatchStyle' },
            { role: 'delete' },
            { role: 'selectAll' },
            { type: 'separator' },
            {
              label: 'Speech',
              submenu: [
                { role: 'startSpeaking' },
                { role: 'stopSpeaking' }
              ]
            }
          ] : [
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectAll' }
          ]),
          { type: 'separator' },
          {
            label: 'Editor mode',
            submenu: [
              {
                label: 'Default',
                type: 'radio',
                checked: Main.getEditorMode() === 'default',
                click: function (item) {
                  item.checked = true;
                  setEditorMode('default');
                }
              },
              {
                label: 'Vim',
                type: 'radio',
                checked: Main.getEditorMode() === 'vim',
                click: function (item) {
                  item.checked = true;
                  setEditorMode('vim');
                }
              }
            ]
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          ...(process.env.SUPERINTENDENT_IS_PROD ? [] : devViewSubmenu),
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Tools',
        submenu: [
          {
            label: 'Export schema',
            click: function () {
              Main.exportSchema();
            }
          },
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          ...(Main.isMac() ? [
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' }
          ] : [
            { role: 'close' }
          ])
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Learn More',
            click: async () => {
              const { shell } = require('electron')
              await shell.openExternal('https://docs.superintendent.app/')
            }
          }
        ]
      }
    ]

    // @ts-ignore
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }

  private static async onReady(): Promise<void> {
    Store.initRenderer();

    Main.db = await Workerize.create();

    ipcMain.handle('set-evaluation-mode', async (event, arg) => {
      Main.evaluationMode = !!arg;

      return true;
    });

    ipcMain.handle('query', async (event, sql, table) => {
      return Main.wrapResponse(Main.db.query(sql, table));
    });

    ipcMain.handle('copy', async (event, table, selection) => {
      return Main.wrapResponse(
        Main.db.copy(table, selection)
          .then(({text, html}) => {
            clipboard.write({text, html});
            return true;
          })
      );
    });

    ipcMain.handle('load-more', async (event, table, offset) => {
      return Main.wrapResponse(Main.db.loadMore(table, offset));
    });

    ipcMain.handle('drop', async (event, arg) => {
      return Main.wrapResponse(Main.db.drop(arg));
    });

    ipcMain.handle('rename', async (event, previousTableName, newTableName) => {
      return Main.wrapResponse(Main.db.rename(previousTableName, newTableName));
    });

    ipcMain.handle('export-workflow', async (event, workflow) => {
      return Main.wrapResponse(Main.exportWorkflow(workflow));
    });

    ipcMain.handle('add-csv', async (event, path, withHeader: boolean, format: Format, replace: string) => {
      let separator: string;

      if (format === 'comma') {
        separator = ',';
      } else if (format === 'tab') {
        separator = '\t';
      } else if (format === 'pipe') {
        separator = '|';
      } else if (format === 'semicolon') {
        separator = ';';
      } else if (format === 'colon') {
        separator = ':';
      } else if (format === 'tilde') {
        separator = '~';
      } else if (format === 'sqlite') {
        return Main.wrapResponse(Main.db.addSqlite(path, Main.evaluationMode));
      } else {
        throw new Error();
      }

      return Main.wrapResponse(Main.db.addCsv(path, withHeader, separator, replace, Main.evaluationMode));
    });

    ipcMain.handle('download-csv', async (event, arg) => {
      return Main.wrapResponse(Main.downloadCsv(arg));
    });

    Main.mainWindow = new Main.BrowserWindow({ width: 1280, height: 800, webPreferences: {nodeIntegration: true, nodeIntegrationInWorker: true, contextIsolation: false, sandbox: false}});
    Main.mainWindow.on('close',(e) => {
      const choice = require('electron').dialog.showMessageBoxSync(
        Main.mainWindow,
      {
          type: 'question',
          buttons: ['Yes', 'No'],
          title: 'Confirm',
          message: 'Are you sure you want to quit without saving the workflow?'
        }
      );

      if(choice === 1){
        e.preventDefault();
      }

    });

    let initialFile: string | null = null;
    if (Main.isMac()) {
      initialFile = Main.initialFile;
    } else if (Main.isWin()) {
      initialFile = process.argv[1];
    } else {
      initialFile = process.argv[2];
    }
    const initialFileMap: {[key: string]: string} = initialFile ? {initialFile} : {};
    await Main.mainWindow!.loadFile(
      `${__dirname}/index.html`,
      {
        query: {editorMode: Main.getEditorMode(), ...initialFileMap}
      }
    );
    await Main.maybeEnableDev();
  }

  private static async maybeEnableDev(): Promise<void> {
    if (process.env.SUPERINTENDENT_IS_PROD) { return; }
    Main.mainWindow!.webContents.openDevTools();
  }

  static main(app: Electron.App, browserWindow: typeof BrowserWindow): void {
    Main.BrowserWindow = browserWindow;
    Main.application = app;
    Main.store = new Store();
    Main.buildMenu();
    Main.application.on('window-all-closed', () => {
      Main.application.quit();
    });
    Main.application.on('open-file', (event, path) => {
      if (Main.mainWindow) {
        Main.mainWindow!.webContents.send('open-file', path);
      } else {
        Main.initialFile = path;
      }
    })
    Main.application.on('ready', Main.onReady);
  }
}
