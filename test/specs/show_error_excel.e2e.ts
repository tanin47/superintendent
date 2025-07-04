import { $, expect } from '@wdio/globals'
import { getCaptureExceptionCalls, suppressPurchaseNotice } from './helpers'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('show error for Excel', () => {
  beforeEach(async () => {
    await suppressPurchaseNotice()
  })

  it('shows the error for xls', async () => {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'superintendent-test'))
    const file = path.join(tmpdir, 'test.xls')

    const stream = fs.createWriteStream(file, { flags: 'a' })

    stream.write('{aljewif@#$@#$%,,,')
    stream.write('""sfdjio#%!$!,$,",@')
    stream.close()

    await $('[data-testid="add-files"]').click()
    await $('[data-testid="input-file"]').clearValue()
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile(file))
    await $('[data-testid="import-all-files"]').click()

    await expect($('.swal2-container')).toHaveText(expect.stringContaining('It seems you are trying to load an Excel file'))

    await $('.swal2-container .swal2-confirm').click()

    const calls = await getCaptureExceptionCalls()

    await expect(calls.length).toEqual(1)

    await expect(calls[0][0]).toEqual('Invalid Closing Quote: found non trimable byte after quote at line 1')
    await expect(calls[0][1]).toEqual({ extra: { autoDetect: 'true', fileExtension: 'xls', format: 'comma', headerLine: '{xxxxxxx@#$@#$%,,,""xxxxxx#%!$!,$,",@', problematicLine: '{xxxxxxx@#$@#$%,,,""xxxxxx#%!$!,$,",@', withHeader: 'true' }, tags: { action: 'adding_csv_failed' } })
  })

  it('shows the error for xlsx', async () => {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'superintendent-test'))
    const file = path.join(tmpdir, 'test.xlsx')

    const stream = fs.createWriteStream(file, { flags: 'a' })

    stream.write('{aljewif@#$@#$%,,,')
    stream.write('""sfdjio#%!$!,$,",@')
    stream.close()

    await $('[data-testid="add-files"]').click()
    await $('[data-testid="input-file"]').clearValue()
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile(file))
    await $('[data-testid="import-all-files"]').click()

    await expect($('.swal2-container')).toHaveText(expect.stringContaining('It seems you are trying to load an Excel file'))
  })
})
