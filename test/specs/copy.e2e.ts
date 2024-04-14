import { browser, $, expect } from '@wdio/globals'
import { Key } from 'webdriverio'
import { clearEditor, getEditorValue, setValidLicense } from './helpers'

describe('A simple scenario', () => {
  beforeEach(async () => {
    await setValidLicense()
  })

  it('BUG: it does not add new line at the end', async () => {
    await $('.CodeMirror').click()
    await browser.keys("select 'test', 'testagain'")
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()
    await $('[data-testid="cell-1-1"]').click()
    await browser.keys([Key.Ctrl, 'c'])

    await clearEditor()
    await browser.keys([Key.Ctrl, 'v'])

    await expect(await getEditorValue()).toEqual('test')
  })

  it('copy row', async () => {
    const sql = "select 'test', 'yo', timestamp '2010-12-01'\n" +
          "union all select 'aaa', 'bbb', timestamp '2012-02-24'"

    await clearEditor()
    await $('.CodeMirror').click()
    await browser.keys(sql)
    await $('[data-testid="run-sql"]').click()

    await $('[data-testid="cell-2-0"]').click()
    await browser.keys([Key.Ctrl, 'c'])

    await clearEditor()
    await browser.keys([Key.Ctrl, 'v'])

    await expect(await getEditorValue()).toEqual('aaa,bbb,2012-02-24T00:00:00.000Z')
  })

  it('copy column', async () => {
    await $('[data-testid="cell-0-2"]').click()
    await browser.keys([Key.Ctrl, 'c'])

    await clearEditor()
    await browser.keys([Key.Ctrl, 'v'])

    await expect(await getEditorValue()).toEqual("'yo'\nyo\nbbb")
  })

  it('copy all', async () => {
    await $('[data-testid="cell-0-0"]').click()
    await browser.keys([Key.Ctrl, 'c'])

    await clearEditor()
    await browser.keys([Key.Ctrl, 'v'])

    await expect(await getEditorValue()).toEqual("'test','yo',CAST('2010-12-01' AS TIMESTAMP)\ntest,yo,2010-12-01T00:00:00.000Z\naaa,bbb,2012-02-24T00:00:00.000Z")
  })
})
