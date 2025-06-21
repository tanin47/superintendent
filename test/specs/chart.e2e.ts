import { $, expect } from '@wdio/globals'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { setValidLicense } from './helpers'

describe('Build chart', () => {
  let csvFile: string | null = null
  beforeEach(async () => {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'superintendent-test'))
    csvFile = path.join(tmpdir, 'test.csv')

    const stream = fs.createWriteStream(csvFile, { flags: 'a' })

    stream.write('group,amount\n')
    stream.write('a,1000\n')
    stream.write('b,2000\n')
    stream.write('c,1500\n')
    stream.write('d,3000\n')
    stream.end()

    await setValidLicense()
  })

  afterEach(() => {
    if (csvFile) {
      fs.unlinkSync(csvFile)
    }
  })

  it('imports a csv and visualize', async () => {
    await $('[data-testid="add-files"]').click()
    await $('[data-testid="input-file"]').clearValue()
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile(csvFile!))
    await $('[data-testid="import-all-files"]').click()

    await expect($('.toolbarSection .total')).toHaveText('4 rows')
    await $('[data-testid="toggle-tabularize-visualize"]').click()

    await (expect($('.chart-container'))).toExist()
  })
})
