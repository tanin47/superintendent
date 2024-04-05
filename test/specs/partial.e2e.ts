import { $, expect } from '@wdio/globals'

describe('Change column type', () => {
  it('create a table', async () => {
    await $('.CodeMirror').click()
    await browser.keys("select * from (select 123, '2022-10-04', 3.14) order by 1 desc")
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect($('.sheet')).toHaveText(
      '123\n2022-10-04\n3.14\n' +
            " 123\n'2022-10-04'\n3.14\n" +
            '1'
    )
  })

  it('create a draft from partial', async () => {
    await $('.CodeMirror').executeScript('document.querySelector(".CodeMirror").CodeMirror.setSelection({line: 0, ch: 15}, {line: 0, ch: 25})', [])
    await $('.CodeMirror').click({ button: 'right' })
    await $('[data-testid="editor-context-menu-run-draft"]').click()
    await expect($('.sheet')).toHaveText(
      '123\n' +
            ' 123\n' +
            '1'
    )
    await expect($('[data-testid="sheet-section-item-_T_DRAFT_T_"]')).toHaveElementClass(expect.stringContaining('selected'))
  })

  it('create a new query from partial', async () => {
    await $('.CodeMirror').click({ button: 'right' })
    await $('[data-testid="editor-context-menu-run-new"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect($('.sheet')).toHaveText(
      '123\n' +
            ' 123\n' +
            '1'
    )
    await expect($('[data-testid="sheet-section-item-auklet"]')).toHaveElementClass(expect.stringContaining('selected'))
  })

  it('create a draft', async () => {
    await $('.CodeMirror').executeScript('document.querySelector(".CodeMirror").CodeMirror.setSelection({line: 0, ch: 0})', [])
    await $('.CodeMirror').click({ button: 'right' })
    await $('[data-testid="editor-context-menu-run-draft"]').click()
    await expect($('.sheet')).toHaveText(
      '123\n2022-10-04\n3.14\n' +
            " 123\n'2022-10-04'\n3.14\n" +
            '1'
    )
    await expect($('[data-testid="sheet-section-item-_T_DRAFT_T_"]')).toHaveElementClass(expect.stringContaining('selected'))
  })

  it('create a new query from partial', async () => {
    await $('.CodeMirror').click({ button: 'right' })
    await $('[data-testid="editor-context-menu-run-new"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect($('.sheet')).toHaveText(
      '123\n2022-10-04\n3.14\n' +
            " 123\n'2022-10-04'\n3.14\n" +
            '1'
    )
    await expect($('[data-testid="sheet-section-item-bishop"]')).toHaveElementClass(expect.stringContaining('selected'))
  })
})
