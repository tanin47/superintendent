import { $, expect } from '@wdio/globals'
import { selectMenu } from './helpers'

describe('Correct license', () => {
  it('uses a correct license', async () => {
    await selectMenu('File', 'Enter a license')

    const license = '---- Superintendent license ----\n' +
          'Email: tanin47@gmail.com\n' +
          'Expired: 2024-09-20T23:57:20.766258645\n' +
          'Signature:\n' +
          'S+OqcwpMQdf4J3TRpIbqQ/wg4+XbGRoaHj/Z4rVIyVti8i3QabKl6vBchU8tHWq1\n' +
          'UBHXBTCKksvLgqNaL//oXBwyGbaPQokHf60fzlLEy1qwZo9G5RmBYhvs7cHlrkJe\n' +
          'U5QalYQc1X+chwy+c8fPizeO+ZPkPrLptlVZJJhnB/c=\n' +
          '---- End of Superintendent license ----'
    await $('#checkLicenseForm textarea').setValue(license)
    await $('#checkLicenseForm [data-testid="submit-button"]').click()

    await expect(await $('.toolbarSection')).toExist()

    await selectMenu('File', 'Enter a license')
    await expect($('.valid-license')).toHaveText('You do not need to buy another license. You currently have a license that will expire on Sep 20, 2024.')
  })
})
