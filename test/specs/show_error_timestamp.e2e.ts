import { $, expect } from '@wdio/globals'
import { clearEditor, fillEditor, getCaptureExceptionCalls } from './helpers'

describe('show error for timestamp', () => {
  it('shows an error correct, send error', async () => {
    await clearEditor()
    await fillEditor('select strptime(\'random\', \'stuff\')')
    await $('[data-testid="run-sql"]').click()

    await expect($('.swal2-container')).toHaveText(expect.stringContaining('format specifier'))
    await expect($('.swal2-container')).toHaveText(expect.stringContaining('Could not parse string'))
    await expect($('.swal2-container')).toHaveText(expect.stringContaining('the strptime documentation'))

    await $('.swal2-container .swal2-confirm').click()

    const calls = await getCaptureExceptionCalls()

    await expect(calls.length).toEqual(1)

    await expect(calls[0][0]).toEqual(expect.stringContaining('Could not parse string'))
    await expect(calls[0][1]).toEqual({ extra: { sql: 'select strptime(\'random\', \'stuff\')' }, tags: { action: 'querying_failed' } })
  })
})
