import { $, browser, expect } from '@wdio/globals'
import { bypassLicense, fillEditor, getTabs, getWindowHandles } from './helpers'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('Workflow', () => {
  let workflowFile: string
  beforeAll(async () => {
    await bypassLicense()

    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'superintendent-test'))
    workflowFile = path.join(tmpdir, 'test.super')
  })

  it('builds workflow', async () => {
    await $('[data-testid="add-files"]').click()
    await $('[data-testid="input-file"]').clearValue()
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/specs/csv-samples/user.csv'))
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/specs/csv-samples/height.csv'))
    await $('[data-testid="import-all-files"]').click()

    await expect($('.sheet')).toHaveText(
      '1\n170\n' +
      '2\n175\n' +
      '3\n165\n' +
      ' id\nheight\n' +
      '1\n2\n3'
    )

    await expect(await getTabs()).toEqual([
      { label: 'user', isSelected: false },
      { label: 'height', isSelected: true }
    ])

    await fillEditor('select u.id, name, height from user u join height h on u.id = h.id order by u.id asc')
    await $('[data-testid="run-sql"]').click()
    await expect($('.sheet')).toHaveText(
      '1\ntanin\n170\n' +
      '2\njohn\n175\n' +
      '3\nrachel\n165\n' +
      ' id\nname\nheight\n' +
      '1\n2\n3'
    )
  })

  it('saves workflow', async () => {
    const dialog = await browser.electron.mockAll('dialog')
    await dialog.showSaveDialogSync.mockReturnValue(workflowFile)
    await dialog.showOpenDialogSync.mockReturnValue([workflowFile])

    await browser.electron.execute(
      async (electron) => {
        const fileMenu = electron.Menu.getApplicationMenu()!.items.find((i) => i.label === 'File')!
        const saveWorkflowMenu = fileMenu.submenu!.items.find((i) => i.label === 'Save Workflow')!
        saveWorkflowMenu.click()
      }
    )
  })

  it('loads workflow', async () => {
    let windowHandles = await getWindowHandles()
    await expect(windowHandles.length).toEqual(1)
    const firstWindowHandle = windowHandles[0]!

    await browser.electron.execute(
      async (electron) => {
        const fileMenu = electron.Menu.getApplicationMenu()!.items.find((i) => i.label === 'File')!
        const loadWorkflowMenu = fileMenu.submenu!.items.find((i) => i.label === 'Load Workflow')!
        loadWorkflowMenu.click()
      }
    )

    await browser.waitUntil(async () => {
      windowHandles = await getWindowHandles()
      return windowHandles.length === 2
    })

    const newWindowHandle = (await getWindowHandles()).find((h) => h !== firstWindowHandle)!

    await browser.switchToWindow(newWindowHandle)

    await bypassLicense()
  })

  it('populates the loaded workflow', async () => {
    await $('[data-testid="add-files"]').click()
    await $('[data-testid="input-file"]').clearValue()
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/specs/csv-samples/user.csv'))
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/specs/csv-samples/height.csv'))

    await $('[data-testid="add-csv-sheet-option"]').selectByVisibleText('Replace user')
    await $$('[data-testid="add-csv-sheet-option"]')[1].selectByVisibleText('Replace height')
    await $('[data-testid="import-all-files"]').click()

    await $('[data-testid="project-item-albatross"] span').click()
    await $('[data-testid="run-sql"]').click()
    await expect($('.sheet')).toHaveText(
      '1\ntanin\n170\n' +
      '2\njohn\n175\n' +
      '3\nrachel\n165\n' +
      ' id\nname\nheight\n' +
      '1\n2\n3'
    )
  })
})
