import { $, expect, browser } from '@wdio/globals'
import { expectDefaultEditorText, fillEditor, getEditorValue, setValidLicense } from './helpers'

describe('Sort', () => {
  beforeEach(async () => {
    await setValidLicense()
  })

  it('sort 1 column', async () => {
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

    await $('[data-testid="cell-0-2"]').moveTo()
    await $('[data-testid="cell-0-2"] [data-testid="sort-button"]').click()

    await expect($('[data-testid="cell-1-2"]')).toHaveText('10')
    await expect($('[data-testid="cell-2-2"]')).toHaveText('20')
    await expect($('[data-testid="cell-3-2"]')).toHaveText('20')
    await expect($('[data-testid="cell-4-2"]')).toHaveText('30')

    await $('[data-testid="cell-0-2"]').moveTo()
    await $('[data-testid="cell-0-2"] [data-testid="sort-button"]').click()

    await expect($('[data-testid="cell-1-2"]')).toHaveText('30')
    await expect($('[data-testid="cell-2-2"]')).toHaveText('20')
    await expect($('[data-testid="cell-3-2"]')).toHaveText('20')
    await expect($('[data-testid="cell-4-2"]')).toHaveText('10')

    await $('[data-testid="cell-0-2"]').moveTo()
    await $('[data-testid="cell-0-2"] [data-testid="sort-button"]').click()

    await expect($('[data-testid="cell-1-2"]')).toHaveText('20')
    await expect($('[data-testid="cell-2-2"]')).toHaveText('30')
    await expect($('[data-testid="cell-3-2"]')).toHaveText('20')
    await expect($('[data-testid="cell-4-2"]')).toHaveText('10')

    await expect($('[data-testid="project-item-456sort"] .fa-file-csv')).toExist() // The isCsv marker is not replaced.
  })

  it('sort multiple columns', async () => {
    await expect($('.sheet')).toHaveText(
      'a\n20\n200\n' +
      'a\n30\n100\n' +
      'b\n20\n300\n' +
      'c\n10\n400\n' +
      ' first_col\n123_second_col\nthird_col\n' +
      '1\n2\n3\n4'
    )

    await $('[data-testid="cell-0-2"]').moveTo()
    await $('[data-testid="cell-0-2"] [data-testid="sort-button"]').click()

    await expect($('[data-testid="cell-1-2"]')).toHaveText('10')
    await expect($('[data-testid="cell-2-2"]')).toHaveText('20')
    await expect($('[data-testid="cell-3-2"]')).toHaveText('20')
    await expect($('[data-testid="cell-4-2"]')).toHaveText('30')

    await $('[data-testid="cell-0-1"]').moveTo()
    await $('[data-testid="cell-0-1"] [data-testid="sort-button"]').click()

    await expect($('[data-testid="cell-1-1"]')).toHaveText('c')
    await expect($('[data-testid="cell-2-1"]')).toHaveText('a')
    await expect($('[data-testid="cell-3-1"]')).toHaveText('b')
    await expect($('[data-testid="cell-4-1"]')).toHaveText('a')

    await $('[data-testid="cell-0-1"]').moveTo()
    await $('[data-testid="cell-0-1"] [data-testid="sort-button"]').click()

    await expect($('.sheet')).toHaveText(
      'c\n10\n400\n' +
      'b\n20\n300\n' +
      'a\n20\n200\n' +
      'a\n30\n100\n' +
      ' first_col\n123_second_col\nthird_col\n' +
      '1\n2\n3\n4'
    )

    await expect($('[data-testid="project-item-456sort"] .fa-file-csv')).toExist() // The icon is not replaced.
  })

  it('BUG: ensure SQL is not changed', async () => {
    await fillEditor('select * from "456sort"')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect($('[data-testid="cell-1-1"]')).toHaveText('c')
    await expect($('[data-testid="cell-2-1"]')).toHaveText('b')
    await expect($('[data-testid="cell-3-1"]')).toHaveText('a')
    await expect($('[data-testid="cell-4-1"]')).toHaveText('a')

    await $('[data-testid="cell-0-1"]').click() // no idea why we have to click. If we don't, it wouldn't click the sort button correctly.
    await $('[data-testid="cell-0-1"]').moveTo()
    await $('[data-testid="cell-0-1"] [data-testid="sort-button"]').click()

    await expect($('[data-testid="cell-1-1"]')).toHaveText('a')
    await expect($('[data-testid="cell-2-1"]')).toHaveText('a')
    await expect($('[data-testid="cell-3-1"]')).toHaveText('b')
    await expect($('[data-testid="cell-4-1"]')).toHaveText('c')

    await $('[data-testid="project-item-456sort"] span').click()
    await expectDefaultEditorText()

    await $('[data-testid="project-item-albatross"] span').click()
    await browser.waitUntil(async () => await getEditorValue() === 'select * from "456sort"')
    await expect($('[data-testid="project-item-albatross"] .fa-caret-square-right')).toExist() // The isCsv marker is not replaced.
  })
})
