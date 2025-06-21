import { $, expect, browser } from '@wdio/globals'
import { clearEditor, fillEditor, getEditorValue, setValidLicense } from './helpers'

describe('draft notice', () => {
  beforeEach(async () => {
    await setValidLicense()
  })

  it('new lines do not trigger the draft notice', async () => {
    await clearEditor()
    await fillEditor('select 1, 2')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect(await getEditorValue()).toEqual('select 1, 2')

    await $('[data-testid="new-sql"]').click()

    await clearEditor()
    await fillEditor('select 3, 4')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()

    await $('[data-testid="project-item-albatross"] span').click()
    await clearEditor()
    await fillEditor('\nselect 1, 2\n')
    await expect(await getEditorValue()).toEqual('\nselect 1, 2\n')

    await $('[data-testid="project-item-anhinga"] span').click()
    await $('[data-testid="project-item-albatross"] span').click()
    await expect($('[data-testid="draft-notice"]')).not.toExist()
  })

  it('revert', async () => {
    await clearEditor()
    await fillEditor('select 1, 2, 3')
    await expect(await getEditorValue()).toEqual('select 1, 2, 3')

    await $('[data-testid="project-item-anhinga"] span').click()
    await $('[data-testid="project-item-albatross"] span').click()
    await expect($('[data-testid="draft-notice"]')).toExist()
    await $('[data-testid="draft-notice"] .link').click()

    await expect(await getEditorValue()).toEqual('select 1, 2')
  })

  it("makes new SQL doesn't trigger draft notice", async () => {
    await fillEditor('select 1, 2, 4')
    await $('[data-testid="new-sql"]').click()

    await expect($('[data-testid="project-item-draft-3"]')).toHaveElementClass(expect.stringContaining('selected'))

    await $('[data-testid="project-item-albatross"] span').click()
    await browser.waitUntil(async () => await getEditorValue() == 'select 1, 2')
    await expect($('[data-testid="draft-notice"]')).not.toExist()
  })
})
