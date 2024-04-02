import { $, browser, expect } from '@wdio/globals'
import { Key } from 'webdriverio'

export async function clearEditor (): Promise<void> {
  await $('.CodeMirror').click()
  await browser.keys([Key.Ctrl, 'a'])
  await browser.keys(Key.Backspace)
  await $('.CodeMirror').click()
}

export async function fillEditor (text: string): Promise<void> {
  await clearEditor()
  await browser.keys(text)
}

export async function expectDefaultEditorText (): Promise<void> {
  await expect($('.CodeMirror')).toHaveText('Compose a beautiful SQL...\n1')
}

export interface Tab {
  label: string
  isSelected: boolean
}

export async function getTabs (): Promise<Tab[]> {
  return await $$('[data-testid="sheet-item-list"] .tab')
    .map(async (elem) => {
      return {
        label: await elem.getText(),
        isSelected: (await elem.getAttribute('class')).includes('selected')
      }
    })
}

export async function getSelectedText (): Promise<string> {
  return (await browser.executeScript('return window.getSelection().toString()', []))
}

export async function bypassLicense (): Promise<void> {
  await expect($('#checkLicenseForm')).toExist()
  await browser.electron.execute(
    async (electron) => {
      electron.BrowserWindow.getAllWindows()[0].webContents.send('bypass-license')
    }
  )
  await expect($('.toolbarSection')).toExist()
}

export async function getWindowHandles (): Promise<string[]> {
  const original = await browser.getWindowHandle()
  const windowHandles = await browser.getWindowHandles()

  const result: string[] = []

  for (const h of windowHandles) {
    await browser.switchToWindow(h)
    const title = await browser.getTitle()

    // Filter out the Inpsect tab if it's open.
    if (title !== 'DevTools') {
      result.push(h)
    }
  }

  await browser.switchToWindow(original)

  return result
}
