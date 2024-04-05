import { $, expect } from '@wdio/globals'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('Change column type', () => {
  let csvFile: string | null = null
  beforeEach(() => {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'superintendent-test'))
    csvFile = path.join(tmpdir, 'test.csv')

    const stream = fs.createWriteStream(csvFile, { flags: 'a' })

    stream.write('id,name\n')

    for (let i = 0; i < 2010; i++) {
      stream.write(`${i},name${i}\n`)
    }
  })

  afterEach(() => {
    if (csvFile) {
      fs.unlinkSync(csvFile)
    }
  })

  it('imports a csv', async () => {
    await $('[data-testid="add-files"]').click()
    await $('[data-testid="input-file"]').clearValue()
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile(csvFile!))
    await $('[data-testid="import-all-files"]').click()

    await expect($('.toolbarSection .total')).toHaveText('2,000 rows(Only 1,000 are shown)')
  })
})
