import { $, expect } from '@wdio/globals'
import { selectMenu } from './helpers'

describe('Correct license', () => {
  it('uses a correct license', async () => {
    await selectMenu('File', 'Enter a license')

    const license = '---- Superintendent license ----\n' +
        'Email: tanin47@gmail.com\n' +
        'Expired: 2026-03-28T02:41:53.808092351\n' +
        'Signature:\n' +
        'KFeT9BgEmVOJZr932OLi6XhIJhANQWkwGJQMQxpJ6hCp6lGPDt5DhuTnMPlKEyGJ\n' +
        'S5h/56vJM62LSf2+otv4/ja9BxJ/gQ/SxmAuGVI4mE6N+cElS1jg6JwHJD5MzrIm\n' +
        'yjAyEL/347uFqLjXRCrdeTr6XeuVMXbW3K551+5bQng=\n' +
        '---- End of Superintendent license ----'
    await $('#checkLicenseForm textarea').setValue(license)
    await $('#checkLicenseForm [data-testid="submit-button"]').click()

    await expect(await $('.toolbarSection')).toExist()

    await selectMenu('File', 'Enter a license')
    await expect($('.valid-license')).toHaveText('You do not need to buy another license. You currently have a license that will expire on Sep 20, 2024.')
  })
})
