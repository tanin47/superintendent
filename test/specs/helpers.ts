import { $, $$, browser, expect } from '@wdio/globals'
import { Key, type ChainablePromiseElement } from 'webdriverio'
import fs from "fs";

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

export async function clearUpdateEditor (): Promise<void> {
  await $('[data-testid="update-editor"] .CodeMirror').click()
  await browser.keys([Key.Ctrl, 'a'])
  await browser.keys(Key.Backspace)
  await $('[data-testid="update-editor"] .CodeMirror').click()
}

export async function fillUpdateEditor (text: string): Promise<void> {
  await clearUpdateEditor()
  await browser.keys(text)
}

export async function clear (elem: ChainablePromiseElement): Promise<void> {
  await elem.click()
  await browser.keys([Key.Ctrl, 'a'])
  await browser.keys(Key.Backspace)
  await elem.click()
}

export async function fill (elem: ChainablePromiseElement, text: string): Promise<void> {
  await clear(elem)
  await elem.click()
  await browser.keys(text)
}

export async function selectMenu (category: string, item: string): Promise<void> {
  await browser.electron.execute(
    async (electron, args) => {
      const categoryItem = electron.Menu.getApplicationMenu()!.items.find((i) => i.label === args[0])!
      const menuItem = categoryItem.submenu!.items.find((i) => i.label === args[1])!
      menuItem.click()
    },
    [category, item]
  )
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
  return await browser.executeScript('return window.getSelection().toString()', [])
}

export async function getCaptureExceptionCalls (): Promise<any[][]> {
  return await browser.executeScript('return window.captureExceptionCalls', [])
}

const TEST_VALID_LICENSE = fs.readFileSync('./secrets/VALID_LICENSE', 'utf-8').trim()

export async function setValidLicense (): Promise<void> {
  await browser.executeScript(`window.storeApi.set('license-key', atob('${Buffer.from(TEST_VALID_LICENSE).toString('base64')}'))`, [])
}

export async function suppressPurchaseNotice (): Promise<void> {
  await browser.executeScript(`window.storeApi.set("purchaseNoticeShownAt", ${new Date().getTime()})`, []) // now
}

export async function getEditorValue (): Promise<string> {
  return await browser.executeScript("return document.querySelector('.CodeMirror').CodeMirror.getValue()", [])
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
