import { $, expect } from '@wdio/globals'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('Correct license', () => {
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

  it('uses a correct license', async () => {
    await $('[data-testid="add-files"]').click()
    await $('.license-notice.free .click').click()

    const license = '---- Superintendent license ----\n' +
          'Email: tanin47@gmail.com\n' +
          'Expired: 2024-09-20T23:57:20.766258645\n' +
          'Signature:\n' +
          'S+OqcwpMQdf4J3TRpIbqQ/wg4+XbGRoaHj/Z4rVIyVti8i3QabKl6vBchU8tHWq1\n' +
          'UBHXBTCKksvLgqNaL//oXBwyGbaPQokHf60fzlLEy1qwZo9G5RmBYhvs7cHlrkJe\n' +
          'U5QalYQc1X+chwy+c8fPizeO+ZPkPrLptlVZJJhnB/c=\n' +
          '---- End of Superintendent license ----'
    await $('#checkLicenseForm textarea').setValue(license)
    await $('#checkLicenseForm button').click()

    await expect(await $('.toolbarSection')).toExist()

    await $('[data-testid="add-files"]').click()
    await expect($('.license-notice.free')).not.toExist()
    await expect($('.license-notice.paid')).toHaveText('You are using the paid version. Your license will expire on Sep 20, 2024')

    await $('[data-testid="input-file"]').clearValue()
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile(csvFile!))
    await $('[data-testid="import-all-files"]').click()

    await expect($('.toolbarSection .total')).toHaveText('2,010 rows(Only 1,000 are shown)')
  })
})
