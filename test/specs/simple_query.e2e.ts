import {$, expect} from '@wdio/globals'

describe('By pass license', () => {
    it('successfully', async () => {
        await browser.electron.execute(async (electron) => {
            electron.BrowserWindow.getAllWindows()[0].webContents.send('bypass-license');
        });
        await expect(await $('.toolbarSection')).toExist();
    });
});
