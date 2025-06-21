import { $, expect } from '@wdio/globals'
import { fillEditor, setValidLicense } from './helpers'

describe('A simple scenario', () => {
  beforeEach(async () => {
    await setValidLicense()
  })

  it('updates the same table over and over', async () => {
    await fillEditor("select 'test'")
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-textbox"]').setValue('new_table')
    await $('[data-testid="rename-button"]').click()

    await expect($('.toolbarSection .total')).toHaveText('1 row')

    await expect($('.sheet')).toHaveText(
      'test\n' +
      " 'test'\n" +
      '1'
    )

    await fillEditor('select * from (select 1 as a, 2 as b union all select 3 as a, 4 as b) order by a asc')
    await $('[data-testid="run-sql"]').click()

    await expect($('.toolbarSection .total')).toHaveText('2 rows')

    await expect($('.sheet')).toHaveText(
      '1\n2\n' +
      '3\n4\n' +
      ' a\nb\n' +
      '1\n2'
    )

    await fillEditor('select 6, 7')
    await $('[data-testid="run-sql"]').click()
    await expect($('.sheet')).toHaveText(
      '6\n7\n' +
      ' 6\n7\n' +
      '1'
    )
  })
})
