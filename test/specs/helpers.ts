import {$, browser, expect} from "@wdio/globals";
import {Key} from "webdriverio";

export async function clearEditor() {
  await $('.CodeMirror').click();
  await browser.keys([Key.Ctrl, 'a']);
  await browser.keys(Key.Backspace);
  await $('.CodeMirror').click();
}

export async function fillEditor(text: string) {
  await clearEditor();
  await browser.keys(text);
}

export type Tab = {
  label: string,
  isSelected: boolean
};

export async function getTabs(): Promise<Tab[]> {
  return $$('[data-testid="sheet-item-list"] .tab')
    .map(async (elem) => {
      return {
        label: await elem.getText(),
        isSelected: (await elem.getAttribute("class")).includes('selected')
      };
    });
}

export async function bypassLicense() {
  await expect($('#checkLicenseForm')).toExist();
  await browser.electron.execute(
    async (electron) => {
      electron.BrowserWindow.getAllWindows()[0].webContents.send('bypass-license');
    },
  );
  await expect($('.toolbarSection')).toExist();
}

export async function getWindowHandles() {
  const original = await browser.getWindowHandle()
  const windowHandles = await browser.getWindowHandles();

  const result: string[] = [];

  for (const h of windowHandles) {
    await browser.switchToWindow(h);
    const title = await browser.getTitle();

    // Filter out the Inpsect tab if it's open.
    if (title != 'DevTools') {
      result.push(h);
    }
  }

  await browser.switchToWindow(original);

  return result;
}
