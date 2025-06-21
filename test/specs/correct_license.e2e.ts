import { $, expect } from '@wdio/globals'
import { selectMenu } from './helpers'
import fs from "fs";

describe('Correct license', () => {
  it('uses a correct license', async () => {
    await selectMenu('File', 'Enter a license')

    const license = fs.readFileSync('./secrets/VALID_LICENSE', 'utf-8').trim()

    await $('#checkLicenseForm textarea').setValue(license)
    await $('#checkLicenseForm [data-testid="submit-button"]').click()

    await expect($('.toolbarSection')).toExist()

    await selectMenu('File', 'Enter a license')
    await expect($('.valid-license')).toHaveText('You do not need to buy another license. You currently have a license that will expire on 27 Mar 2026.')
  })
})
