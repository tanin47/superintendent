import { $, expect } from '@wdio/globals'
import { clearEditor, fillEditor, setValidLicense } from './helpers'

describe('draft notice', () => {
  beforeEach(async () => {
    await setValidLicense()
  })

  it('shows an error correct', async () => {
    await clearEditor()
    await fillEditor('select jibberish some-thing')
    await $('[data-testid="run-sql"]').click()

    await expect($('.swal2-container')).toHaveText(expect.stringContaining('syntax error at or near "some"'))
  })
})
