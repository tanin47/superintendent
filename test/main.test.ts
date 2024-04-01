import { dialog, shell } from 'electron'
import { type BrowserWindow } from 'electron'
import { type Workspace } from '../src/main'
import Main from '../src/main'
import { type Datastore } from '../src/data-store/Datastore'
import Store from 'electron-store'

jest.mock('electron', () => ({
  dialog: {
    showMessageBox: jest.fn()
  },
  shell: {
    openExternal: jest.fn()
  }
}))

describe('the update notice', () => {
  const space: Workspace = {
    window: 'fake-window' as any as BrowserWindow,
    db: null as any as Datastore
  }

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const mockedShowMessageBox = dialog.showMessageBox as any
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const mockedOpenExternal = shell.openExternal as any

  beforeEach(() => {
    jest.clearAllMocks()

    mockedOpenExternal.mockResolvedValue()

    Main.store = new Store({ name: 'testing' })
    Main.store.clear()

    jest.useFakeTimers()
    jest.setSystemTime(new Date(2020, 3, 1))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('does nothing because it is the first run', async () => {
    await Main.maybeShowUpdateNotice(space)
  })

  it('shows the dialog box after 35 days and opens the website', async () => {
    mockedShowMessageBox.mockResolvedValue({ response: 0 })

    await Main.maybeShowUpdateNotice(space)

    jest.advanceTimersByTime(36 * 86400 * 1000)
    await Main.maybeShowUpdateNotice(space)

    await expect(mockedShowMessageBox.mock.calls).toEqual([[
      'fake-window',
      {
        buttons: ['Go to our website', 'Close'],
        defaultId: 0,
        message: 'Superintendent.app releases a new update regularly.\n\nPlease check a new update on our website.',
        title: 'Check new update',
        type: 'info'
      }
    ]])
    await expect(mockedOpenExternal.mock.calls).toEqual([['https://superintendent.app/?ref=update']])
  })

  it('shows the dialog box after 35 days but close', async () => {
    mockedShowMessageBox.mockResolvedValue({ response: 1 })

    await Main.maybeShowUpdateNotice(space)

    jest.advanceTimersByTime(30 * 86400 * 1000)
    await Main.maybeShowUpdateNotice(space) // not show

    jest.advanceTimersByTime(6 * 86400 * 1000)
    await Main.maybeShowUpdateNotice(space)

    jest.advanceTimersByTime(15 * 86400 * 1000)
    await Main.maybeShowUpdateNotice(space) // not show

    await expect((dialog.showMessageBox as any).mock.calls).toEqual([[
      'fake-window',
      {
        buttons: ['Go to our website', 'Close'],
        defaultId: 0,
        message: 'Superintendent.app releases a new update regularly.\n\nPlease check a new update on our website.',
        title: 'Check new update',
        type: 'info'
      }
    ]])
    await expect(mockedOpenExternal.mock.calls).toEqual([])
  })
})
