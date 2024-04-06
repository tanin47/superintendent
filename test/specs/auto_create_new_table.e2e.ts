import { $, expect } from '@wdio/globals'
import { fillEditor } from './helpers'

describe('A simple scenario', () => {
  it('creates a new table if the current query uses the current table', async () => {
    await fillEditor("select 'test'")
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-textbox"]').setValue('new_table')
    await $('[data-testid="rename-button"]').click()

    await expect($('.toolbarSection .total')).toHaveText('1 row')

    await fillEditor('select * from new_table')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()

    const names = await $$('.project-panel .item .name').map(async (i) => await i.getText())
    await expect(names).toEqual(['anhinga', 'new_table'])

    await expect($('.toolbarSection .total')).toHaveText('1 row')

    await $('[data-testid="sheet-section-item-anhinga"] .fa-times').click()
    await $('[data-testid="sheet-section-item-new_table"] .fa-times').click()

    await expect($('.toolbarSection .total')).not.toExist()

    await $('[data-testid="project-item-new_table"]').click()
    await expect($('.CodeMirror')).toHaveText("1\nselect 'test'")
    await expect($('[data-testid="draft-notice"]')).not.toExist()
  })
})
