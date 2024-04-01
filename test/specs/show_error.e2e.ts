import { browser, $, expect } from '@wdio/globals'
import { clearEditor, fillEditor } from './helpers'

describe('draft notice', () => {
  beforeAll(async () => {
    await browser.electron.execute((electron) => {
      electron.BrowserWindow.getAllWindows()[0].webContents.send('bypass-license')
    })
    await expect($('.toolbarSection')).toExist()
  })

  it('shows an error correct', async () => {
    await clearEditor()
    await fillEditor('select jibberish some-thing')
    await $('[data-testid="run-sql"]').click()

    await expect($('.swal2-container')).toHaveText(expect.stringContaining('syntax error at or near "some"'))
  })
})
