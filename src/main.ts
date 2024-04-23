import { BrowserWindow, dialog, ipcMain, Menu, clipboard, shell } from 'electron'
import Store from 'electron-store'
import { type Datastore } from './data-store/Datastore'
import { Workerize } from './data-store/Workerize'
import {
  type CopySelection,
  type EditorMode, EditorModeChannel,
  type ExportDelimiter,
  ExportDelimiters, type ExportedWorkflow, ExportWorkflowChannel,
  type Format, ImportWorkflowChannel, type Sort, type ColumnType,
  GoToPurchaseLicense,
  StartImportingWorkflowChannel,
  ShowErrorDialogChannel
} from './types'
import fs from 'fs'
import path from 'path'
import os from 'os'
import archiver from 'archiver'
import unzipper from 'unzipper'

const ExportDelimiterLabels = {
  comma: 'Comma (,)',
  tab: 'Tab',
  pipe: 'Pipe (|)',
  semicolon: 'Semicolon (;)',
  colon: 'Colon (:)',
  tilde: 'Tilde (~)'
}

const ExportDelimiterSymbols = {
  comma: ',',
  tab: '\t',
  pipe: '|',
  semicolon: ';',
  colon: ':',
  tilde: '~'
}

export interface Workspace {
  window: BrowserWindow
  db: Datastore
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export default class Main {
  static spaces = new Map<number, Workspace>()
  static application: Electron.App
  static store: Store
  static initialFile: string | null = null

  private static isMac (): boolean {
    return process.platform === 'darwin'
  }

  private static isWin (): boolean {
    return process.platform === 'win32'
  }

  private static getFocusedSpace (): Workspace {
    for (const space of Main.spaces.values()) {
      if (space.window.isFocused()) {
        return space
      }
    }

    throw new Error("There's no focused space")
  }

  private static getSpace (event: Electron.IpcMainInvokeEvent): Workspace {
    return Main.spaces.get(event.sender.id)!
  }

  private static async downloadCsv (space: Workspace, table: string, exportDelimiter: ExportDelimiter): Promise<string | null> {
    const file = dialog.showSaveDialogSync(
      space.window,
      {
        defaultPath: `${table}.csv`,
        filters: [{ name: 'All files', extensions: ['*'] }]
      }
    )

    if (!file) {
      return null
    }

    await space.db.exportCsv(table, file, ExportDelimiterSymbols[exportDelimiter] || ExportDelimiterSymbols.comma)
    return file
  }

  private static async initImportWorkflow (): Promise<void> {
    const space = Main.getFocusedSpace()

    // On Linux, the file dialog steals the focus.
    const files = dialog.showOpenDialogSync(
      space.window,
      {
        filters: [{ name: 'All files', extensions: ['*'] }]
      }
    )

    if (!files || files.length === 0) {
      return
    }

    await Main.importWorkflow(files[0], space)
  }

  private static async importWorkflow (file: string, space: Workspace): Promise<void> {
    let selectedSpace = space

    // May switch windows
    const tables = await selectedSpace.db.getAllTables()
    if (tables.length > 0) {
      selectedSpace = await Main.makeWorkspace()
    }
    selectedSpace.window.webContents.send(StartImportingWorkflowChannel)

    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'superintendent-import'))

    try {
      await fs.createReadStream(file).pipe(unzipper.Extract({ path: tmpdir })).promise()

      await selectedSpace.db.import(tmpdir)

      const data = fs.readFileSync(path.join(tmpdir, 'workspace.json'), { encoding: 'utf8', flag: 'r' })
      const workflow: ExportedWorkflow = JSON.parse(data)

      for (let i = 0; i < workflow.results.length; i++) {
        const result = workflow.results[i]
        await selectedSpace.db.reserveTableName(result.name)
        const newResult = await selectedSpace.db.loadTable(result.name)

        workflow.results[i] = {
          ...newResult,
          ...result
        }
      }

      const promise = new Promise<void>((resolve) => {
        // Wait for the new workspace to initialize.
        const loadWorkflowFunc = async (): Promise<void> => {
          const isLoaded = await selectedSpace.window.webContents.executeJavaScript('window.importWorkflowHookIsLoaded')

          if (isLoaded) {
            selectedSpace.window.webContents.send(ImportWorkflowChannel, workflow)
            resolve()
          } else {
            setTimeout(() => { void loadWorkflowFunc() }, 100)
          }
        }
        void loadWorkflowFunc()
      })
      await promise
    } catch (e) {
      selectedSpace.window.webContents.send(
        ShowErrorDialogChannel,
        {
          title: 'Importing workspace failed',
          errorMessage: (e as any).message,
          postBody: 'If you are looking to import a CSV, please use the button "Add files".\n\nPlease contact support@superintendent.app if you have an issue importing a workspace.'
        }
      )
    } finally {
      fs.rmSync(tmpdir, { recursive: true, force: true })
    }
  }

  private static async initExportWorkflow (space: Workspace): Promise<void> {
    const file = dialog.showSaveDialogSync(
      space.window,
      {
        defaultPath: `workspace_${new Date().toISOString().replace(/[^0-9]+/g, '-').replace(/-$/, '')}.super`,
        filters: [{ name: '.super', extensions: ['super'] }]
      }
    )

    if (!file) {
      return
    }

    space.window.webContents.send(ExportWorkflowChannel, { file })
  }

  private static async exportWorkflow (
    space: Workspace,
    file: string,
    workflow: ExportedWorkflow
  ): Promise<{ file: string }> {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'superintendent-export'))

    try {
      await space.db.export(tmpdir)

      const workspaceFile = path.join(tmpdir, 'workspace.json')
      const writer = fs.createWriteStream(workspaceFile, { flags: 'w' })
      writer.write(JSON.stringify(workflow, null, 2))
      writer.close()

      const zipOutput = fs.createWriteStream(file)
      const archive = archiver('zip', { zlib: { level: 0 } })
      archive.pipe(zipOutput)

      archive.directory(tmpdir, false)

      await archive.finalize()

      return { file }
    } finally {
      fs.rmSync(tmpdir, { recursive: true, force: true })
    }
  }

  private static async wrapResponse (resp: Promise<any>): Promise<any> {
    return await resp
      .then((r) => ({
        success: true,
        data: r
      }))
      .catch((e) => {
        return { success: false, message: e.message }
      })
  }

  private static getEditorMode (): EditorMode {
    return (Main.store.get('editorMode') as (EditorMode | undefined)) ?? 'default'
  }

  private static getExportDelimiter (): ExportDelimiter {
    return (Main.store.get('exportDelimiter') as (ExportDelimiter | undefined)) ?? 'comma'
  }

  private static getLatestUpdateNoticeShownAt (): number | null {
    return Main.store.get('latestUpdateNoticeShownAt') as (number | undefined) ?? null
  }

  static setLatestUpdateNoticeShownAt (): void {
    Main.store.set('latestUpdateNoticeShownAt', new Date().getTime())
  }

  private static buildMenu (): void {
    const devViewSubmenu = [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' }
    ]

    const setExportDelimiter = (delimiter: ExportDelimiter): void => {
      Main.store.set('exportDelimiter', delimiter)
    }

    const setEditorMode = (mode: EditorMode): void => {
      Main.store.set('editorMode', mode)

      Main.spaces.forEach((space) => {
        space.window.webContents.send(EditorModeChannel, mode)
      })
    }

    const template = [
      ...(Main.isMac()
        ? [{
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
          }]
        : []),
      {
        label: 'File',
        submenu: [
          {
            label: 'New Workspace',
            accelerator: process.platform === 'darwin' ? 'Cmd+Shift+W' : 'Ctrl+Shift+W',
            click: () => {
              void Main.makeWorkspace()
            }
          },
          { type: 'separator' },
          {
            label: 'Save Workspace',
            accelerator: process.platform === 'darwin' ? 'Cmd+S' : 'Ctrl+S',
            click: () => {
              void Main.initExportWorkflow(Main.getFocusedSpace())
            }
          },
          {
            label: 'Load Workspace',
            accelerator: process.platform === 'darwin' ? 'Cmd+L' : 'Ctrl+L',
            click: () => {
              void Main.initImportWorkflow()
            }
          },
          { type: 'separator' },
          {
            label: 'Enter a license',
            click: () => {
              Main.getFocusedSpace().window.webContents.send(GoToPurchaseLicense)
            }
          }
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
          ...(Main.isMac()
            ? [
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
              ]
            : [
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
                  item.checked = true
                  setEditorMode('default')
                }
              },
              {
                label: 'Vim',
                type: 'radio',
                checked: Main.getEditorMode() === 'vim',
                click: function (item) {
                  item.checked = true
                  setEditorMode('vim')
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
                item.checked = true
                setExportDelimiter(delimiter)
              }
            }))
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
          ...(Main.isMac()
            ? [
                { type: 'separator' },
                { role: 'front' }
              ]
            : [
              ])
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Visit our website',
            click: async () => {
              await shell.openExternal('https://superintendent.app/?ref=help')
            }
          },
          {
            label: 'See SQL reference',
            click: async () => {
              await shell.openExternal('https://duckdb.org/docs/sql/query_syntax/select')
            }
          },
          ...(process.env.SUPERINTENDENT_IS_PROD
            ? []
            : [
                {
                  label: 'Clear the license',
                  click: async () => {
                    Main.store.delete('license-key')
                  }
                },
                {
                  label: 'Clear the purchase notice shown at',
                  click: async () => {
                    Main.store.delete('purchaseNoticeShownAt')
                  }
                },
                {
                  label: 'Set the purchase notice shown at to be older than 12h ago',
                  click: async () => {
                    Main.store.set('purchaseNoticeShownAt', new Date().getTime() - (12 * 60 * 60 * 1000) + 1)
                  }
                }
              ])
        ]
      }
    ]

    // @ts-expect-error unable to make the type work.
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }

  private static async makeWorkspace (): Promise<Workspace> {
    const window = new BrowserWindow({
      width: 1280,
      minWidth: 800,
      height: 800,
      minHeight: 600,
      webPreferences: {
        sandbox: false,
        preload: path.resolve(process.env.SUPERINTENDENT_IS_PROD ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'prod') : path.join('dist', 'dev'), 'preload.js')
      }
    })

    const db = await Workerize.create()
    await db.open()

    const space = { window, db }
    Main.spaces.set(space.window.webContents.id, space)

    space.window.on('close', (e) => {
      if (!process.env.ENABLE_WDIO) {
        const choice = dialog.showMessageBoxSync(
          space.window,
          {
            type: 'question',
            buttons: ['Yes', 'No'],
            defaultId: 1,
            title: 'Confirm',
            message: 'Are you sure you want to quit without saving the workflow?'
          }
        )

        if (choice !== 0) {
          e.preventDefault()
          return
        }
      }

      void space.db.close()

      Main.spaces.delete(space.window.webContents.id)
    })

    let initialFile: string | null = null
    if (Main.isMac()) {
      initialFile = Main.initialFile
    } else if (Main.isWin()) {
      initialFile = process.argv[1]
    } else {
      initialFile = process.argv[2]
    }

    if (initialFile) {
      if (
        (!process.env.SUPERINTENDENT_IS_PROD && initialFile.endsWith('main.js')) ||
          (process.env.ENABLE_WDIO === 'yes' && initialFile.startsWith('--'))
      ) {
        // Do nothing.
        initialFile = null
      }
    }

    const initialFileMap: { initialFile?: string } = initialFile ? { initialFile } : {}

    await space.window.loadFile(
      path.join(__dirname, 'index.html'),
      {
        query: { editorMode: Main.getEditorMode(), ...initialFileMap }
      }
    )
    space.window.webContents.session.setSpellCheckerEnabled(false)

    if (!process.env.SUPERINTENDENT_IS_PROD) {
      space.window.webContents.openDevTools()
    }

    return space
  }

  static async maybeShowUpdateNotice (space: Workspace): Promise<void> {
    const latest = Main.getLatestUpdateNoticeShownAt()

    if (latest === null) {
      Main.setLatestUpdateNoticeShownAt()
      return
    }

    const now = new Date().getTime()

    if ((now - latest) > (35 * 86400 * 1000)) {
      void dialog.showMessageBox(
        space.window,
        {
          type: 'info',
          buttons: ['Go to our website', 'Close'],
          defaultId: 0,
          title: 'Check new update',
          message: 'Superintendent.app releases a new update regularly.\n\nPlease check a new update on our website.'
        }
      )
        .then((choice) => {
          if (choice.response === 0) {
            void shell.openExternal('https://superintendent.app/?ref=update')
          }
        })
      Main.setLatestUpdateNoticeShownAt()
    }
  }

  static showPurchaseNotice (): void {
    const choice = dialog.showMessageBoxSync(
      Main.getFocusedSpace().window,
      {
        type: 'info',
        buttons: ['Purchase a license', 'Close'],
        defaultId: 0,
        title: 'Evaluation',
        message: 'You are evaluating Superintendent.app and may continue evaluating it for free.\n\nHowever, you must purchase a license for continued use.'
      }
    )

    if (choice === 0) {
      Main.getFocusedSpace().window.webContents.send(GoToPurchaseLicense)
    }
  }

  private static async onReady (): Promise<void> {
    Store.initRenderer()

    ipcMain.handle('show-purchase-notice', async () => {
      this.showPurchaseNotice()
    })

    ipcMain.handle('query', async (event, sql: string, table: string | null) => {
      return await Main.wrapResponse(Main.getSpace(event).db.query(sql, table))
    })

    ipcMain.handle('sort', async (event, table: string, sorts: Sort[]) => {
      return await Main.wrapResponse(Main.getSpace(event).db.sort(table, sorts))
    })

    ipcMain.handle('copy', async (event, table: string, selection: CopySelection) => {
      return await Main.wrapResponse(
        Main.getSpace(event).db.copy(table, selection)
          .then(({ text, html }) => {
            clipboard.write({ text, html })
            return true
          })
      )
    })

    ipcMain.handle(ExportWorkflowChannel, async (event, file: string, workflow: ExportedWorkflow) => {
      return await Main.wrapResponse(Main.exportWorkflow(Main.getSpace(event), file, workflow))
    })

    ipcMain.handle('load-more', async (event, table: string, offset: number) => {
      return await Main.wrapResponse(Main.getSpace(event).db.loadMore(table, offset))
    })

    ipcMain.handle('drop', async (event, table: string) => {
      return await Main.wrapResponse(Main.getSpace(event).db.drop(table))
    })

    ipcMain.handle('rename', async (event, previousTableName: string, newTableName: string) => {
      return await Main.wrapResponse(Main.getSpace(event).db.rename(previousTableName, newTableName))
    })

    ipcMain.handle('change-column-type', async (event, tableName: string, columnName: string, newColumnType: ColumnType, timestampFormat: string | null) => {
      return await Main.wrapResponse(Main.getSpace(event).db.changeColumnType(tableName, columnName, newColumnType, timestampFormat))
    })

    ipcMain.handle('add-csv', async (event, path: string, withHeader: boolean, format: Format, replace: string) => {
      let separator: string

      if (format === 'comma') {
        separator = ','
      } else if (format === 'tab') {
        separator = '\t'
      } else if (format === 'pipe') {
        separator = '|'
      } else if (format === 'semicolon') {
        separator = ';'
      } else if (format === 'colon') {
        separator = ':'
      } else if (format === 'tilde') {
        separator = '~'
      } else if (format === 'super') {
        return await Main.wrapResponse(Main.importWorkflow(path, Main.getSpace(event)))
      } else {
        throw new Error()
      }

      return await Main.wrapResponse(Main.getSpace(event).db.addCsv(path, withHeader, separator, replace))
    })

    ipcMain.handle('download-csv', async (event, table: string) => {
      return await Main.wrapResponse(Main.downloadCsv(Main.getSpace(event), table, Main.getExportDelimiter()))
    })

    const space = await Main.makeWorkspace()
    await Main.maybeShowUpdateNotice(space)

    if (process.platform === 'darwin') {
      const dockMenu = Menu.buildFromTemplate([
        {
          label: 'New Workspace',
          click: () => {
            void Main.makeWorkspace()
          }
        }
      ])
      Main.application.dock.setMenu(dockMenu)
    }
  }

  static main (app: Electron.App, browserWindow: typeof BrowserWindow): void {
    Main.application = app
    Main.store = new Store()
    Main.buildMenu()
    Main.application.on('window-all-closed', () => {
      Main.application.quit()
    })
    Main.application.on('open-file', (event, file) => {
      if (Main.spaces.size > 0) {
        this.getFocusedSpace().window.webContents.send('open-file', file)
      } else {
        Main.initialFile = file
      }
    })
    void Main.application.whenReady().then(async () => {
      await Main.onReady()
    })
  }
}
