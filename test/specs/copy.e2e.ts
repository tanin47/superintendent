import {browser, $, expect} from '@wdio/globals'
import {Key} from 'webdriverio'
import {clearEditor} from "./helpers";

describe('A simple scenario', () => {
    beforeAll(async () => {
        await browser.electron.execute((electron) => {
            electron.BrowserWindow.getAllWindows()[0].webContents.send('bypass-license');
        });
        await expect($('.toolbarSection')).toExist();
    });

    it('BUG: it does not add new line at the end', async () => {
        await $('.CodeMirror').click();
        await browser.keys("select 'test', 'testagain'");
        await $('[data-testid="run-sql"]').click();
        await $('[data-testid="cell-1-1"]').click();
        await browser.keys([Key.Ctrl, 'c']);

        await clearEditor();
        await browser.keys([Key.Ctrl, 'v']);

        await expect($('.CodeMirror')).toHaveText("1\ntest");
    });
});
