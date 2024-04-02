import { browser, $, expect } from '@wdio/globals'
import { fillEditor } from './helpers'

describe('A simple scenario', () => {
  beforeAll(async () => {
    await browser.electron.execute((electron) => {
      electron.BrowserWindow.getAllWindows()[0].webContents.send('bypass-license')
    })
    await expect($('.toolbarSection')).toExist()
  })

  it('creates a new table if the current query uses the current table', async () => {
    await fillEditor("select 'test'")
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-textbox"]').setValue('new_table')
    await $('[data-testid="rename-button"]').click()

    await fillEditor('select * from new_table')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="cancel-rename-button"]').click()

    const names = await $$('.project-panel .item .name').map(async (i) => await i.getText())
    await expect(names).toEqual(['anhinga', 'new_table'])
  })
})
