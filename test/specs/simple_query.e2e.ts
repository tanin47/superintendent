import {$, expect} from '@wdio/globals'
import {Key} from 'webdriverio'

describe('A simple scenario', () => {
    beforeAll(async () => {
        await browser.electron.execute(async (electron) => {
            electron.BrowserWindow.getAllWindows()[0].webContents.send('bypass-license');
        });
        await expect($('.toolbarSection')).toExist();
    });

    it('select 1', async () => {
        await $('.CodeMirror').click();
        await browser.keys("select 1");
        await $('[data-testid="run-sql"]').click();
        await expect($('.sheet')).toHaveText("1\n 1\n1");
    });

    it('add a csv', async () => {
        await $('[data-testid="add-files"]').click();
        const remoteFilePath = await browser.uploadFile('./test/data-store/csv-samples/csv.csv');
        await $('[data-testid="input-file"]').setValue(remoteFilePath);
        await $('[data-testid="import-all-files"]').click();
        await expect($('.sheet')).toHaveText(
          "Harmonia\n" +
          "Waite\n" +
          "Har\"quote\"monia.Waite@yopmail.com\n" +
          "Joy\n" +
          "something,another\n" +
          "Joy.Haerr@yopmail.com\n" +
          " firstname\n" +
          "last_quote_name\n" +
          "email\n" +
          "1\n" +
          "2"
        );
    });

    it("joins 2 table", async () => {
        await $('[data-testid="new-sql"]').click();
        await $('.CodeMirror').click();
        await browser.keys("select 1".split('').map(() => Key.Backspace));
        await browser.keys("select * from csv join albatross");
        await $('[data-testid="run-sql"]').click();
        await expect($('.sheet')).toHaveText(
          "Harmonia\n" +
          "Waite\n" +
          "Har\"quote\"monia.Waite@yopmail.com\n" +
          "1\n" +
          "Joy\n" +
          "something,another\n" +
          "Joy.Haerr@yopmail.com\n" +
          "1\n" +
          " firstname\n" +
          "last_quote_name\n" +
          "email\n" +
          "1\n" +
          "1\n" +
          "2"
        );
    });
});
