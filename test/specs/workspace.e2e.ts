import { $, $$, browser, expect } from '@wdio/globals'
import { fillEditor, getEditorValue, getTabs, getWindowHandles, selectMenu, setValidLicense } from './helpers'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('Workflow', () => {
  let workflowFile: string
  beforeEach(async () => {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'superintendent-test'))
    workflowFile = path.join(tmpdir, 'test.super')

    await setValidLicense()
  })

  afterEach(async () => {
    fs.rmSync(workflowFile, { force: true })
  })

  it('builds workflow', async () => {
    await $('[data-testid="add-files"]').click()
    await $('[data-testid="input-file"]').clearValue()
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/specs/csv-samples/user.csv'))
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/specs/csv-samples/height.csv'))
    await $('[data-testid="import-all-files"]').click()

    await expect($('.sheet')).toHaveText(
      '1\n170\n' +
      '2\n175\n' +
      '3\n165\n' +
      ' id\nheight\n' +
      '1\n2\n3'
    )

    await expect(await getTabs()).toEqual([
      { label: 'user', isSelected: false },
      { label: 'height', isSelected: true }
    ])

    await fillEditor('select u.id, name, height from user u join height h on u.id = h.id order by u.id desc')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect($('.sheet')).toHaveText(
      '3\nrachel\n165\n' +
      '2\njohn\n175\n' +
      '1\ntanin\n170\n' +
      ' id\nname\nheight\n' +
      '1\n2\n3'
    )

    await $('.CodeMirror').executeScript('document.querySelector(".CodeMirror").CodeMirror.setSelection({line: 0, ch: 0}, {line: 0, ch: 80})', [])
    await $('.CodeMirror').click({ button: 'right' })
    await $('[data-testid="editor-context-menu-run-draft"]').click()
    await expect($('.sheet')).toHaveText(
      '1\ntanin\n170\n' +
      '2\njohn\n175\n' +
      '3\nrachel\n165\n' +
      ' id\nname\nheight\n' +
      '1\n2\n3'
    )

    await $('[data-testid="new-sql"]').click()
    await fillEditor('select 1, 2, 3')
  })

  it('saves workflow', async () => {
    const dialog = await browser.electron.mockAll('dialog')
    await dialog.showSaveDialogSync.mockReturnValue(workflowFile)
    await selectMenu('File', 'Save Workspace')

    await expect($('.swal2-container')).toHaveText(expect.stringContaining(`The workspace has been saved at: ${workflowFile}`))

    await $('.swal2-container .swal2-confirm').click()

    // Move file to simulate real-world
    const newWorkflowFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'superintendent-test')), 'test.super')
    fs.renameSync(workflowFile, newWorkflowFile)

    await dialog.showOpenDialogSync.mockReturnValue([newWorkflowFile])
  })

  it('loads workflow', async () => {
    let windowHandles = await getWindowHandles()
    await expect(windowHandles.length).toEqual(1)
    const firstWindowHandle = windowHandles[0]!

    await selectMenu('File', 'Load Workspace')

    await browser.waitUntil(async () => {
      windowHandles = await getWindowHandles()
      return windowHandles.length === 2
    })

    const newWindowHandle = (await getWindowHandles()).find((h) => h !== firstWindowHandle)!

    await browser.switchToWindow(newWindowHandle)
  })

  it('populates the loaded workflow', async () => {
    const names = await $$('.project-panel .item .name').map(async (i) => await i.getText())
    await expect(names).toEqual(['draft-1', 'draft-2', 'height', 'user', 'albatross'])

    const sheetNames = await $$('[data-testid="sheet-item-list"] .label').map(async (i) => await i.getText())
    await expect(sheetNames).toEqual(['user', 'height', 'albatross', 'draft'])

    await $('[data-testid="project-item-albatross"]').doubleClick()
    await expect(await getEditorValue()).toEqual('select u.id, name, height from user u join height h on u.id = h.id order by u.id desc')
    await expect($('.sheet')).toHaveText(
      '3\nrachel\n165\n' +
      '2\njohn\n175\n' +
      '1\ntanin\n170\n' +
      ' id\nname\nheight\n' +
      '1\n2\n3'
    )

    await $('[data-testid="project-item-draft-2"]').click()
    await expect(await getEditorValue()).toEqual('select 1, 2, 3')

    await $('[data-testid="sheet-section-item-_T_DRAFT_T_"]').click()
    await expect($('.sheet')).toHaveText(
      '1\ntanin\n170\n' +
      '2\njohn\n175\n' +
      '3\nrachel\n165\n' +
      ' id\nname\nheight\n' +
      '1\n2\n3'
    )

    await $('[data-testid="sheet-section-item-user"]').click()
    await expect($('.sheet')).toHaveText(
      '1\ntanin\n' +
      '2\njohn\n' +
      '3\nrachel\n' +
      ' id\nname\n' +
      '1\n2\n3'
    )

    await $('[data-testid="sheet-section-item-height"]').click()
    await expect($('.sheet')).toHaveText(
      '1\n170\n' +
      '2\n175\n' +
      '3\n165\n' +
      ' id\nheight\n' +
      '1\n2\n3'
    )

    await fillEditor('select * from albatross limit 1')
    await $('[data-testid="run-sql"]').click()
    await $('[data-testid="rename-button"]').click()
    await expect($('.sheet')).toHaveText(
      '3\nrachel\n165\n' +
      ' id\nname\nheight\n' +
      '1'
    )
  })
})
