(window.miscApi as any) = {
  isWdioEnabled: () => true
}

import { cryptoApi, storeApi } from '../../../src/external'
import { checkIfLicenseIsValid, extractLicenseInfo } from '../../../src/frontend/api'
import fs from 'fs'

describe('api', () => {
  it('extractPublicKey', async () => {
    const signature = [
      'C3lQRUFPBKoR6c0WDGf+wX3eXjQAzbtuoiydQazME3BgTOealmvVOvZ4UsiRhApP\n' +
      'H56QaX5OedNAIJOE28KyCIglM6j1sv1hFDa2vKGTECyt7Z0h+jCOrM3qoZqR6mi5\n' +
      'h5foGvDRGJN1WyqfrIie+v87/261KoIo2Y7wEBolmxA='
    ].join('\n')
    const expired = '2024-06-30T19:02:38.282408'
    const license = `---- Superintendent license ----
Email: fake@fakeemail.com
Expired: ${expired}
Signature:
${signature}
---- End of Superintendent license ----`

    await expect(extractLicenseInfo(license, 'Signature')).toEqual(signature)
    await expect(extractLicenseInfo(license, 'Expired')).toEqual(expired)
  })

  it('validates the license key correctly', async () => {
    if (!fs.existsSync('./secrets/license.json')) {
      // Skip running this test.
      return
    }

    (window as any).cryptoApi = cryptoApi;
    (window as any).storeApi = storeApi

    jest.useFakeTimers().setSystemTime(new Date('2022-07-23'))
    const contract = JSON.parse(fs.readFileSync('./secrets/license.json').toString()) as { licenseKey: string }

    await expect(checkIfLicenseIsValid(contract.licenseKey)).toStrictEqual({ success: true })
    await expect(checkIfLicenseIsValid(contract.licenseKey.replace('tanin', 'tnn'))).toStrictEqual({
      success: false,
      errorMessage: 'The license key is not valid. Please contact support@superintendent.app.'
    })
    // Expire
    jest.useFakeTimers().setSystemTime(new Date('2022-08-30'))
    await expect(checkIfLicenseIsValid(contract.licenseKey)).toStrictEqual({
      success: false,
      errorMessage: 'The license key has expired. Please buy a new license at superintendent.app.'
    })
  })
})
