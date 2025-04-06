import { $, expect } from '@wdio/globals'

describe('Show the purchase notice', () => {
  it('show the purchase notice when adding a CSV and goes to the purchase page', async () => {
    await browser.executeScript('window.storeApi.set("license-key", "invalid")', [])
    await browser.executeScript(`window.storeApi.set("purchaseNoticeShownAt", ${new Date().getTime() - 25200000})`, []) // 7 hours

    const dialog = await browser.electron.mockAll('dialog')
    await dialog.showMessageBoxSync.mockReturnValue(0)

    await $('[data-testid="add-files"]').click()
    await $('[data-testid="input-file"]').clearValue()
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/specs/csv-samples/column_detection.csv'))
    await $('[data-testid="import-all-files"]').click()

    await expect($('#checkLicenseForm')).toBeDisplayed()
    await $('[data-testid="cancel-button"]').click()

    const currentShownAt = await browser.executeScript('return window.storeApi.get("purchaseNoticeShownAt")', [])
    await expect(currentShownAt).toBeGreaterThan(new Date().getTime() - 60 * 1000)

    // The second time doesn't show the dialog
    await $('[data-testid="add-files"]').click()
    await $('[data-testid="input-file"]').clearValue()
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/specs/csv-samples/column_detection.csv'))
    await $('[data-testid="import-all-files"]').click()

    await expect($('#checkLicenseForm')).not.toBeDisplayed()
  })
})
