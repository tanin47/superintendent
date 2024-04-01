import { browser, $, expect } from '@wdio/globals'
import { fillEditor } from './helpers'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('A simple scenario', () => {
  beforeAll(async () => {
    await browser.electron.execute((electron) => {
      electron.BrowserWindow.getAllWindows()[0].webContents.send('bypass-license')
    })
    await expect($('.toolbarSection')).toExist()
  })

  it('builds data', async () => {
    await fillEditor("select 'test', 'testagain'")
    await $('[data-testid="run-sql"]').click()

    await $('[data-testid="new-sql"]').click()
    await fillEditor("select 'another', 123")
    await $('[data-testid="run-sql"]').click()
  })

  it('exports the second sheet', async () => {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'superintendent-test'))
    const file = path.join(tmpdir, 'test.csv')

    const dialog = await browser.electron.mockAll('dialog')
    await dialog.showSaveDialogSync.mockReturnValue(file)

    await $('[data-testid="export-sheet"]').click()

    await browser.waitUntil(async () => {
      return fs.existsSync(file)
    })
    await expect(fs.readFileSync(file).toString()).toEqual("'another',123\nanother,123\n")

    await $('button.swal2-confirm').click()
  })

  it('exports the first sheet', async () => {
    await $('[data-testid="sheet-section-item-albatross"]').click()

    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'superintendent-test'))
    const file = path.join(tmpdir, 'test.csv')

    const dialog = await browser.electron.mockAll('dialog')
    await dialog.showSaveDialogSync.mockReturnValue(file)

    await $('[data-testid="export-sheet"]').click()

    await browser.waitUntil(async () => {
      return fs.existsSync(file)
    })
    await expect(fs.readFileSync(file).toString()).toEqual("'test','testagain'\ntest,testagain\n")

    await $('button.swal2-confirm').click()
  })
})
