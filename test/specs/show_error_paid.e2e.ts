import { $, expect } from '@wdio/globals'
import { clearEditor, fillEditor, getCaptureExceptionCalls, setValidLicense } from './helpers'

describe('show error (paid)', () => {
  beforeEach(async () => {
    await setValidLicense()
  })

  it('shows an error correct, not sending error', async () => {
    await clearEditor()
    await fillEditor('select jibberish some-thing')
    await $('[data-testid="run-sql"]').click()

    await expect($('.swal2-container')).toHaveText(expect.stringContaining('syntax error at or near "some"'))
    await expect($('.swal2-container')).toHaveText(expect.not.stringContaining('Since you are using the trial version, you cannot opt-out from error reporting.'))

    await $('.swal2-container .swal2-confirm').click()

    await expect(await getCaptureExceptionCalls()).toEqual([])
  })

  it('shows an error correct, send error', async () => {
    await clearEditor()
    await fillEditor('select jibberish some-thing')
    await $('[data-testid="run-sql"]').click()

    await expect($('.swal2-container')).toHaveText(expect.stringContaining('syntax error at or near "some"'))

    await $('#errorReportingCheckbox').click()

    await $('.swal2-container .swal2-confirm').click()

    const calls = await getCaptureExceptionCalls()

    await expect(calls.length).toEqual(1)

    await expect(calls[0][0]).toEqual("Parser Error: syntax error at or near \"some\"\n" +
      "\n" +
      "LINE 1: CREATE TABLE \"anhinga\" AS select jibberish some-thing\n" +
      "                                                   ^")
    await expect(calls[0][1]).toEqual({ extra: { sql: 'select jibberish some-thing' }, tags: { action: 'querying_failed' } })
  })
})
