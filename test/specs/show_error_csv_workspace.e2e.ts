import { $, expect } from '@wdio/globals'
import { getCaptureExceptionCalls, selectMenu, suppressPurchaseNotice } from './helpers'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('show error for Excel', () => {
  beforeEach(async () => {
    await suppressPurchaseNotice()
  })

  it('shows an error correct, send error', async () => {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'superintendent-test'))
    const file = path.join(tmpdir, 'test.csv')

    const stream = fs.createWriteStream(file, { flags: 'a' })

    stream.write('something,aaa')
    stream.close()

    const dialog = await browser.electron.mockAll('dialog')
    await dialog.showOpenDialogSync.mockReturnValue([file])

    await selectMenu('File', 'Load Workspace')

    await expect($('.swal2-container')).toHaveText(expect.stringContaining('If you are looking to import a CSV, please use the button "Add files".'))

    await $('.swal2-container .swal2-confirm').click()

    const calls = await getCaptureExceptionCalls()

    await expect(calls.length).toEqual(1)

    await expect(calls[0][0]).toMatch(/is this a zip file/)
    await expect(calls[0][1]).toEqual({ extra: { fileExtension: 'csv' }, tags: { action: 'importing_workflow_failed' } })
  })
})
