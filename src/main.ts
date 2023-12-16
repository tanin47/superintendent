import {BrowserWindow, dialog, ipcMain, Menu, clipboard, shell, app} from 'electron';
import Store from 'electron-store';
import {Datastore} from "./data-store/Datastore";
import {Workerize} from "./data-store/Workerize";
import {
  EditorMode, EditorModeChannel,
  ExportDelimiter,
  ExportDelimiters, ExportedWorkflow, ExportWorkflowChannel,
  Format, ImportWorkflowChannel,
} from "./types";
import fs from "fs";
import {getRandomBird} from "./data-store/Birds";
import path from "path";

const ExportDelimiterLabels = {
  comma: 'Comma (,)',
  tab: 'Tab',
  pipe: 'Pipe (|)',
  semicolon: 'Semicolon (;)',
  colon: 'Colon (:)',
  tilde: 'Tilde (~)'
};

const ExportDelimiterSymbols = {
  comma: ',',
  tab: '\t',
  pipe: '|',
  semicolon: ';',
  colon: ':',
  tilde: '~'
};

type Workspace = {
  window: BrowserWindow,
  db: Datastore
}

export default class Main {
  static spaces: Map<number, Workspace> = new Map();
  static application: Electron.App;
  static store: Store;
  static initialFile: string | null = null;

  private static isMac(): boolean {
    return process.platform === 'darwin';
  }

  private static isWin(): boolean {
    return process.platform === 'win32';
  }

  private static getFocusedSpace(): Workspace {
    for (const space of Main.spaces.values()) {
      if (space.window.isFocused())  {
        return space;
      }
    }

    throw new Error("There's no focused space");
  }

  private static getSpace(event: Electron.IpcMainInvokeEvent): Workspace {
    return Main.spaces.get(event.sender.id)!;
  }

  private static async downloadCsv(space: Workspace, table: string, exportDelimiter: ExportDelimiter): Promise<string | null> {
    const file = dialog.showSaveDialogSync(
      space.window,
      {
        defaultPath: `${table}.csv`,
        filters: [{name: 'All files', extensions: ['*']}]
      }
    );

    if (!file) {
      return null;
    }

    await space.db.exportCsv(table, file, ExportDelimiterSymbols[exportDelimiter] || ExportDelimiterSymbols.comma);
    return file;
  }

  private static async initImportWorkflow(): Promise<void> {
    let space = Main.getFocusedSpace();

    const files = dialog.showOpenDialogSync(
      space.window,
      {
        filters: [{name: 'All files', extensions: ['*']}]
      }
    );

    if (!files || files.length === 0) {
      return;
    }

    return Main.importWorkflow(files[0]);
  }

  private static async importWorkflow(file: string, space:  Workspace | null = null): Promise<void> {
    let selectedSpace = space || Main.getFocusedSpace();
    const data = fs.readFileSync(file, {encoding: 'utf8', flag: 'r'});

    // May switch windows
    const tables = await selectedSpace.db.getAllTables();
    if (tables.length > 0) {
      selectedSpace = await Main.makeWorkspace();
    }

    const workflow: ExportedWorkflow = JSON.parse(data);

    for await (const node of workflow.nodes) {
      await selectedSpace.db.reserveTableName(node.name)
    }

    const promise = new Promise<void>((resolve) => {
      // Wait for the new workspace to initialize.
      const loadWorkflowFunc = async () => {
        const isLoaded = await selectedSpace.window.webContents.executeJavaScript('window.importWorkflowHookIsLoaded');

        if (isLoaded) {
          selectedSpace.window.webContents.send(ImportWorkflowChannel, workflow);
          resolve();
        } else {
          setTimeout(() => loadWorkflowFunc(), 100);
        }
      };
      loadWorkflowFunc();
    });
    return promise;
  }

  private static async initExportWorkflow(space: Workspace): Promise<void> {
    console.log("init export")
    space.window.webContents.send(ExportWorkflowChannel, 'abracadabra');
  }

  private static async exportWorkflow(space: Workspace, workflow: ExportedWorkflow): Promise<string> {
    const file = dialog.showSaveDialogSync(
      space.window,
      {
        defaultPath: `workflow_${getRandomBird()}.super`,
        filters: [{name: '.super', extensions: ['super']}]
      }
    );

    if (!file) {
      return Promise.resolve("exit");
    }

    console.log("export");
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
        return {success: false, message: e.message};
      });
  }

  private static getEditorMode(): EditorMode {
    return (Main.store.get('editorMode') as (EditorMode | null)) || 'default';
  }

  private static getExportDelimiter(): ExportDelimiter {
    return (Main.store.get('exportDelimiter') as (ExportDelimiter | null)) || 'comma';
  }

  private static buildMenu(): void {
    const devViewSubmenu = [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
    ];

    const setExportDelimiter = (delimiter: ExportDelimiter) => {
      Main.store.set('exportDelimiter', delimiter);
    }

    const setEditorMode = (mode: EditorMode) => {
      Main.store.set('editorMode', mode);

      Main.spaces.forEach((space) => {
        space.window.webContents.send(EditorModeChannel, mode);
      });
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
            label: 'New Workspace',
            accelerator: process.platform === 'darwin' ? 'Cmd+Shift+W' : 'Ctrl+Shift+W',
            click: () => {
              Main.makeWorkspace();
            }
          },
          { type: 'separator' },
          {
            label: 'Save Workflow',
            accelerator: process.platform === 'darwin' ? 'Cmd+S' : 'Ctrl+S',
            click: () => {
              Main.initExportWorkflow(Main.getFocusedSpace());
            }
          },
          {
            label: 'Load Workflow' ,
            accelerator: process.platform === 'darwin' ? 'Cmd+L' : 'Ctrl+L',
            click: () => {
              Main.initImportWorkflow();
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
            label: 'Editor Mode',
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
          },
          { type: 'separator' },
          {
            label: 'Export Delimiter',
            submenu: ExportDelimiters.map((delimiter) => ({
              label: ExportDelimiterLabels[delimiter],
              type: 'radio',
              checked: Main.getExportDelimiter() === delimiter,
              click: function (item) {
                item.checked = true;
                setExportDelimiter(delimiter);
              }
            })),
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
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          ...(Main.isMac() ? [
            { type: 'separator' },
            { role: 'front' },
          ] : [
          ])
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Learn More',
            click: async () => {
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

  private static async makeWorkspace(): Promise<Workspace> {
    let window = new BrowserWindow({
      width: 1280,
      minWidth: 800,
      height: 800,
      minHeight: 600,
      webPreferences: {
        sandbox: false,
        preload: path.resolve(process.env.SUPERINTENDENT_IS_PROD ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'prod') : path.join('dist', 'dev'), 'preload.js'),
      }
    });

    let space = {
      window,
      db: await Workerize.create(),
    };
    Main.spaces.set(space.window.webContents.id, space);

    space.window.on('close',(e) => {
      if (!process.env.ENABLE_WDIO) {
        const choice = dialog.showMessageBoxSync(
          space.window,
          {
            type: 'question',
            buttons: ['Yes', 'No'],
            title: 'Confirm',
            message: 'Are you sure you want to quit without saving the workflow?'
          }
        );

        if (choice === 1) {
          e.preventDefault();
          return;
        }
      }

      space.db.close();

      Main.spaces.delete(space.window.webContents.id);
    });

    let initialFile: string | null = null;
    if (Main.isMac()) {
      initialFile = Main.initialFile;
    } else if (Main.isWin()) {
      initialFile = process.argv[1];

      if (initialFile) {
        if (
            (!process.env.SUPERINTENDENT_IS_PROD && initialFile.endsWith("main.js"))
            ||
            (process.env.ENABLE_WDIO === 'yes' && initialFile.startsWith("--"))
        ) {
          // Do nothing. Windows strangely opens these non files.
          initialFile = null;
        }
      }
    } else {
      initialFile = process.argv[2];
    }
    let initialFileMap: { initialFile: string } | {} = initialFile ? {initialFile} : {};

    await space.window.loadFile(
      `${__dirname}/index.html`,
      {
        query: {editorMode: Main.getEditorMode(), ...initialFileMap}
      }
    );

    if (!process.env.SUPERINTENDENT_IS_PROD) {
      space.window.webContents.openDevTools();
    }

    return space;
  }

  private static async onReady(): Promise<void> {
    Store.initRenderer();

    ipcMain.handle('query', async (event, sql, table) => {
      return Main.wrapResponse(Main.getSpace(event).db.query(sql, table));
    });

    ipcMain.handle('copy', async (event, table, selection) => {
      return Main.wrapResponse(
        Main.getSpace(event).db.copy(table, selection)
          .then(({text, html}) => {
            clipboard.write({text, html});
            return true;
          })
      );
    });

    ipcMain.handle(ExportWorkflowChannel, async (event, workflow) => {
      return Main.wrapResponse(Main.exportWorkflow(Main.getSpace(event), workflow));
    });

    ipcMain.handle('load-more', async (event, table, offset) => {
      return Main.wrapResponse(Main.getSpace(event).db.loadMore(table, offset));
    });

    ipcMain.handle('drop', async (event, arg) => {
      return Main.wrapResponse(Main.getSpace(event).db.drop(arg));
    });

    ipcMain.handle('rename', async (event, previousTableName, newTableName) => {
      return Main.wrapResponse(Main.getSpace(event).db.rename(previousTableName, newTableName));
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
      } else if (format === 'super') {
        return Main.wrapResponse(Main.importWorkflow(path, Main.getSpace(event)));
      } else {
        throw new Error();
      }

      return Main.wrapResponse(Main.getSpace(event).db.addCsv(path, withHeader, separator, replace));
    });

    ipcMain.handle('download-csv', async (event, arg) => {
      return Main.wrapResponse(Main.downloadCsv(Main.getSpace(event), arg, Main.getExportDelimiter()));
    });

    await Main.makeWorkspace();

    if (process.platform === 'darwin') {
      const dockMenu = Menu.buildFromTemplate([
        {
          label: 'New Workspace',
          click: () => {
            Main.makeWorkspace();
          }
        }
      ]);
      Main.application.dock.setMenu(dockMenu);
    }
  }

  static main(app: Electron.App, browserWindow: typeof BrowserWindow): void {
    Main.application = app;
    Main.store = new Store();
    Main.buildMenu();
    Main.application.on('window-all-closed', () => {
      Main.application.quit();
    });
    Main.application.on('open-file', (event, file) => {
      if (Main.spaces.size > 0) {
        this.getFocusedSpace().window.webContents.send('open-file', file);
      } else {
        Main.initialFile = file;
      }
    });
    Main.application.whenReady().then(async () => {
      await Main.onReady();
    });
  }
}
