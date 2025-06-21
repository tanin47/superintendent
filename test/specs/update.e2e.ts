import { $, expect } from '@wdio/globals'
import { fillUpdateEditor, setValidLicense } from './helpers'

describe('Update', () => {
  beforeEach(async () => {
    await setValidLicense()
  })

  it('Update column', async () => {
    await $('[data-testid="add-files"]').click()
    await $('[data-testid="input-file"]').clearValue()
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/specs/csv-samples/456sort.csv'))
    await $('[data-testid="import-all-files"]').click()

    await expect($('.sheet')).toHaveText(
      'a\n20\n200\n' +
      'a\n30\n100\n' +
      'b\n20\n300\n' +
      'c\n10\n400\n' +
      ' first_col\n123_second_col\nthird_col\n' +
      '1\n2\n3\n4'
    )

    await $('[data-testid="update-mode-button"]').click()

    await fillUpdateEditor('update "456sort" set third_col = third_col + 2')

    await $('[data-testid="update-sql"]').click()

    await expect($('.swal2-container')).toHaveText(expect.stringContaining('The update on 456sort has been executed successfully.'))
    await $('.swal2-container .swal2-confirm').click()

    await expect($('.sheet')).toHaveText(
      'a\n20\n202\n' +
      'a\n30\n102\n' +
      'b\n20\n302\n' +
      'c\n10\n402\n' +
      ' first_col\n123_second_col\nthird_col\n' +
      '1\n2\n3\n4'
    )
  })
})
