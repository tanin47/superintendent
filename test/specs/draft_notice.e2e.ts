import { $, expect } from '@wdio/globals'
import { clearEditor, fillEditor } from './helpers'

describe('draft notice', () => {
  it('new lines do not trigger the draft notice', async () => {
    await clearEditor()
    await fillEditor('select 1, 2')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect($('.CodeMirror')).toHaveText('1\nselect 1, 2')

    await $('[data-testid="new-sql"]').click()

    await clearEditor()
    await fillEditor('select 3, 4')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()

    await $('[data-testid="project-item-albatross"] span').click()
    await clearEditor()
    await fillEditor('\nselect 1, 2\n')
    await expect($('.CodeMirror')).toHaveText('1\n2\nselect 1, 2\n3')

    await $('[data-testid="project-item-anhinga"] span').click()
    await $('[data-testid="project-item-albatross"] span').click()
    await expect($('[data-testid="draft-notice"]')).not.toExist()
  })

  it('revert', async () => {
    await clearEditor()
    await fillEditor('select 1, 2, 3')
    await expect($('.CodeMirror')).toHaveText('1\nselect 1, 2, 3')

    await $('[data-testid="project-item-anhinga"] span').click()
    await $('[data-testid="project-item-albatross"] span').click()
    await expect($('[data-testid="draft-notice"]')).toExist()
    await $('[data-testid="draft-notice"] .link').click()

    await expect($('.CodeMirror')).toHaveText('1\nselect 1, 2')
  })

  it("makes new SQL doesn't trigger draft notice", async () => {
    await fillEditor('select 1, 2, 4')
    await browser.pause(100000)
    await $('[data-testid="new-sql"]').click()

    await expect($('[data-testid="project-item-draft-3"]')).toHaveElementClass(expect.stringContaining('selected'))

    await $('[data-testid="project-item-albatross"] span').click()
    await expect($('.CodeMirror')).toHaveText('1\nselect 1, 2')
    await expect($('[data-testid="draft-notice"]')).not.toExist()
  })
})
