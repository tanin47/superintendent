import { $, expect } from '@wdio/globals'
import { fillEditor } from './helpers'

describe('A simple scenario', () => {
  it('builds data', async () => {
    await fillEditor("select 'test'")
    await $('[data-testid="new-sql"]').click()
    await fillEditor('select 123')
    await $('[data-testid="new-sql"]').click()
    await fillEditor('select 222')

    await expect($$('.project-panel .item.draft')).toBeElementsArrayOfSize(3)

    await $('[data-testid="project-item-draft-1"]').click()
    await expect($('.CodeMirror-code')).toHaveText("1\nselect 'test'")

    await $('[data-testid="project-item-draft-2"]').click()
    await expect($('.CodeMirror-code')).toHaveText('1\nselect 123')

    await $('[data-testid="project-item-draft-3"]').click()
    await expect($('.CodeMirror-code')).toHaveText('1\nselect 222')
  })

  it('deletes a draft sql', async () => {
    await $('[data-testid="project-item-draft-2"]').click({ button: 'right' })
    await $('[data-testid="project-context-menu-delete"]').click()

    await expect($$('.project-panel .item.draft')).toBeElementsArrayOfSize(2)

    await expect($('[data-testid="project-item-draft-2"]')).not.toExist()
  })

  it('runs the drafl sqls', async () => {
    await $('[data-testid="project-item-draft-1"]').click()
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect($('.sheet')).toHaveText(
      'test\n' +
      " 'test'\n" +
      '1'
    )

    let names = await $$('.project-panel .item .name').map(async (i) => await i.getText())
    await expect(names).toEqual(['draft-3', 'albatross'])

    await $('[data-testid="project-item-draft-3"]').click()
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect($('.sheet')).toHaveText(
      '222\n' +
      ' 222\n' +
      '1'
    )

    names = await $$('.project-panel .item .name').map(async (i) => await i.getText())
    await expect(names).toEqual(['albatross', 'anhinga'])
  })
})
