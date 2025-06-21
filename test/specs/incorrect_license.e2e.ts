import { $, expect } from '@wdio/globals'
import { selectMenu } from './helpers'

describe('Incorrect license', () => {
  it('uses a incorrect license', async () => {
    await selectMenu('File', 'Enter a license')

    const license = '---- Superintendent license ----\n' +
      'Email: fake@fakeemail.com\n' +
      'Expired: 2024-06-30T19:02:38.282408\n' +
      'Signature:\n' +
      'C3lQRUFPBKoR6c0WDGf+wX3eXjQAzbtuoiydQazME3BgTOealmvVOvZ4UsiRhApP\n' +
      'H56QaX5OedNAIJOE28KyCIglM6j1sv1hFDa2vKGTECyt7Z0h+jCOrM3qoZqR6mi5\n' +
      'h5foGvDRGJN1WyqfrIie+v87/261KoIo2Y7wEBClmxA=\n' +
      '---- End of Superintendent license ----'
    await $('#checkLicenseForm textarea').setValue(license)
    await $('#checkLicenseForm button').click()

    await expect($('.error-message')).toHaveText(expect.stringContaining('The license key is not valid.'))
  })
})
