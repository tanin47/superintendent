import { $, expect } from '@wdio/globals'
import { fillEditor, setValidLicense } from './helpers'

describe('Sheet race condition', () => {
  beforeEach(async () => {
    await setValidLicense()
  })

  it('BUG: switching to a sheet with fewer columns will cause a race condition between sheet.columns and columnWidths.current because columnWidths is a ref', async () => {
    await fillEditor('select 1, 2, 3')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect($('[data-testid="cell-1-1"]')).toHaveText('1')

    await $('[data-testid="new-sql"]').click()

    await fillEditor('select 1, 2')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect($('[data-testid="cell-1-1"]')).toHaveText('1')

    await expect($('[data-testid="sheet-section-item-anhinga"]')).toHaveElementClass(expect.stringContaining('selected'))
  })
})
