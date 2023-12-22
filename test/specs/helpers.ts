import {$, browser} from "@wdio/globals";
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
