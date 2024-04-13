import { $, expect } from '@wdio/globals'
import { selectMenu } from './helpers'

describe('Expired license', () => {
  it('uses a expired license', async () => {
    await selectMenu('File', 'Enter a license')

    const license = '---- Superintendent license ----\n' +
          'Name: tanin\n' +
          'Email: tanin47@gmail.com\n' +
          'Expired: 2023-07-29T04:06:28.968065\n' +
          'Signature:\n' +
          'KKJH+knQXSf98lTEsCVie09ihhirm5rx2Vedaih9ZLj/mJ67Zoc3Av3jun9wQH84\n' +
          'pVVSDKPETB9TaDzMwus6/qXcDyyxVftUE7m0BA4LpjjEGvQPfR6O8trPPc+Iykr4\n' +
          'kIxCJ2VClFHW33JDFjlhcs77j6ES9Eeh/kSkw12rpXw=\n' +
          '---- End of Superintendent license ----'
    await $('#checkLicenseForm textarea').setValue(license)
    await $('#checkLicenseForm button').click()

    await expect($('.error-message')).toHaveText(expect.stringContaining('The license key has expired.'))
  })
})
