import { $, expect } from '@wdio/globals'

describe('Show the purchase notice', () => {
  it('show AI Data notice', async () => {
    await browser.executeScript('window.storeApi.delete("aiDataNoticeShownAt")', [])

    await $('[data-testid="toggle-ai"]').click()
    await expect($('.swal2-container')).toHaveText(expect.stringContaining('AI Data Privacy Disclosure'))
    await $('.swal2-container .swal2-confirm').click()
    await expect($('[data-testid="ask-ai-panel"]')).toBeDisplayed()

    await $('[data-testid="toggle-ai"]').click()
    await expect($('[data-testid="ask-ai-panel"]')).not.toBeDisplayed()

    await $('[data-testid="toggle-ai"]').click()
    await expect($('[data-testid="ask-ai-panel"]')).toBeDisplayed()
    await expect($('.swal2-container')).not.toBeDisplayed()

    await $('[data-testid="toggle-ai"]').click()
    await expect($('[data-testid="ask-ai-panel"]')).not.toBeDisplayed()

    await browser.executeScript(`window.storeApi.set("aiDataNoticeShownAt", ${new Date().getTime() - 7862400000})`, []) // 91 days

    await $('[data-testid="toggle-ai"]').click()
    await expect($('.swal2-container')).toHaveText(expect.stringContaining('AI Data Privacy Disclosure'))
    await $('.swal2-container .swal2-confirm').click()
  })
})
