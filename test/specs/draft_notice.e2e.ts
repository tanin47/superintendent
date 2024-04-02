import { browser, $, expect } from '@wdio/globals'
import { clearEditor, fillEditor } from './helpers'

describe('draft notice', () => {
  beforeAll(async () => {
    await browser.electron.execute((electron) => {
      electron.BrowserWindow.getAllWindows()[0].webContents.send('bypass-license')
    })
    await expect($('.toolbarSection')).toExist()
  })

  it('new lines do not trigger the draft notice', async () => {
    await clearEditor()
    await fillEditor('select 1, 2')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="cancel-rename-button"]').click()
    await expect($('.CodeMirror')).toHaveText('1\nselect 1, 2')

    await $('[data-testid="new-sql"]').click()

    await clearEditor()
    await fillEditor('select 3, 4')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="cancel-rename-button"]').click()

    await $('[data-testid="project-item-albatross"] span').click()
    await clearEditor()
    await fillEditor('\nselect 1, 2\n')
    await expect($('.CodeMirror')).toHaveText('1\n2\nselect 1, 2\n3')

    await $('[data-testid="project-item-anhinga"] span').click()
    await $('[data-testid="project-item-albatross"] span').click()
    await expect($('[data-testid="draft-notice"]')).not.toExist()
  })

  it('new lines do not trigger the draft notice', async () => {
    await clearEditor()
    await fillEditor('select 1, 2, 3')
    await expect($('.CodeMirror')).toHaveText('1\nselect 1, 2, 3')

    await $('[data-testid="project-item-anhinga"] span').click()
    await $('[data-testid="project-item-albatross"] span').click()
    await expect($('[data-testid="draft-notice"]')).toExist()
    await $('[data-testid="draft-notice"] .link').click()

    await expect($('.CodeMirror')).toHaveText('1\nselect 1, 2')
  })
})
