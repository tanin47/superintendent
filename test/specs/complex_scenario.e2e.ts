import { $, expect, browser } from '@wdio/globals'
import { clearEditor, expectDefaultEditorText, getEditorValue, getSelectedText, getTabs, setValidLicense } from './helpers'

describe('A simple scenario', () => {
  beforeEach(async () => {
    await setValidLicense()
  })

  it('select 1', async () => {
    await $('.CodeMirror').click()
    await browser.keys('select 1')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect($('.sheet')).toHaveText('1\n 1\n1')
  })

  it('add 2 csvs', async () => {
    await $('[data-testid="add-files"]').click()
    await $('[data-testid="input-file"]').clearValue()
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/data-store/csv-samples/csv.csv'))
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/data-store/csv-samples/tab.tsv'))
    await $('[data-testid="import-all-files"]').click()

    // Show the last imported file, which is tab.tsv
    await expect($('.sheet')).toHaveText(
      'Har\n' +
          'Wat\n' +
          'Har"quote"someone@yopmail.com\n' +
          'Joy\n' +
          'something another\n' +
          'another@yopmail.com\n' +
          ' firstname\n' +
          'last_quote_name\n' +
          'email\n' +
          '1\n' +
          '2'
    )

    await expect(await getTabs()).toEqual([
      { label: 'albatross', isSelected: false },
      { label: 'csv', isSelected: false },
      { label: 'tab', isSelected: true }
    ])
  })

  it('joins 2 table', async () => {
    await $('[data-testid="new-sql"]').click()
    await clearEditor()

    await $('.CodeMirror').click()
    await browser.keys('select * from csv join albatross on true')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect($('.sheet')).toHaveText(
      'Har\n' +
          'Wat\n' +
          'Har"quote"someone@yopmail.com\n' +
          '1\n' +
          'Joy\n' +
          'something,another\n' +
          'another@yopmail.com\n' +
          '1\n' +
          ' firstname\n' +
          'last_quote_name\n' +
          'email\n' +
          '1\n' +
          '1\n' +
          '2'
    )
  })

  it('renames', async () => {
    await $('[data-testid="project-item-albatross"]').click({ button: 'right' })
    await $('[data-testid="project-context-menu-rename"]').click()
    await browser.waitUntil(async () => await getSelectedText() === 'albatross')
    await $('[data-testid="rename-textbox"]').setValue('bird')
    await $('[data-testid="rename-button"]').click()
    await $('[data-testid="project-item-bird"] span').click()
    await browser.waitUntil(async () => await getEditorValue() === 'select 1')
  })

  it('deletes', async () => {
    await $('[data-testid="project-item-bird"]').click({ button: 'right' })
    await $('[data-testid="project-context-menu-delete"]').click()
    await expect($('[data-testid="project-item-bird"]')).not.toExist()
  })

  it('switches sql and sheet, and format SQL', async () => {
    await $('[data-testid="project-item-anhinga"] span').click()
    await expect(await getEditorValue()).toEqual('select * from csv join albatross on true')
    await $('[data-testid="format-sql"] span').click()
    await expect(await getEditorValue()).toEqual('select\n  *\nfrom\n  csv\n  join albatross on true')
    await $('[data-testid="project-item-csv"] span').click()
    await expectDefaultEditorText()

    await $('[data-testid="project-item-csv"]').click({ button: 'right' })
    await $('[data-testid="project-context-menu-view"]').click()
    await expect($('[data-testid="sheet-section-item-csv"]')).toHaveElementClass(expect.stringContaining('selected'))
    await expect($('[data-testid="sheet-section-item-anhinga"]')).not.toHaveElementClass(expect.stringContaining('selected'))

    await browser.pause(500) // there's a transition in the context menu

    await $('[data-testid="project-item-anhinga"]').click({ button: 'right' })
    await $('[data-testid="project-context-menu-view"]').click()
    await expect($('[data-testid="sheet-section-item-anhinga"]')).toHaveElementClass(expect.stringContaining('selected'))
    await expect($('[data-testid="sheet-section-item-csv"]')).not.toHaveElementClass(expect.stringContaining('selected'))
  })
})
