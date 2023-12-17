import {$, expect} from '@wdio/globals'
import {Key} from 'webdriverio'
import {clearEditor} from "./helpers";

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

    it('add 2 csvs', async () => {
        await $('[data-testid="add-files"]').click();
        await $('[data-testid="input-file"]').clearValue();
        await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/data-store/csv-samples/csv.csv'));
        await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/data-store/csv-samples/tab.tsv'));
        await $('[data-testid="import-all-files"]').click();

        // Show the last imported file, which is tab.tsv
        await expect($('.sheet')).toHaveText(
          "Harmonia\n" +
          "Waite\n" +
          "Har\"quote\"monia.Waite@yopmail.com\n" +
          "Joy\n" +
          "something another\n" +
          "Joy.Haerr@yopmail.com\n" +
          " firstname\n" +
          "last_quote_name\n" +
          "email\n" +
          "1\n" +
          "2"
        );

        const tabs = await $$('[data-testid="sheet-item-list"] .tab')
          .map(async (elem) => {
              return {
                  label: await elem.getText(),
                  className: (await elem.getAttribute("class")).trim()
              };
          })

        await expect(tabs).toEqual([
          {label: 'albatross', className: 'tab'},
          {label: 'csv', className: 'tab'},
          {label: 'tab', className: 'tab selected'},
        ]);
    });

    it("joins 2 table", async () => {
        await $('[data-testid="new-sql"]').click();
        await clearEditor();

        await $('.CodeMirror').click();
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

    it("renames", async () => {
        await $('[data-testid="project-item-albatross"]').moveTo();
        await $('[data-testid="rename-albatross"]').click();
        await $('[data-testid="rename-textbox"]').setValue('bird');
        await $('[data-testid="rename-button"]').click();
        await $('[data-testid="project-item-bird"] span').click();
        await expect($('.CodeMirror')).toHaveText("1\nselect 1");
    });

    it("deletes", async () => {
        await expect($('[data-testid="new-sql"]')).toExist();
        await $('[data-testid="project-item-bird"]').moveTo();
        await $('[data-testid="delete-bird"]').click();
        await expect($('[data-testid="project-item-bird"]')).not.toExist();
        await expect($('[data-testid="new-sql"]')).not.toExist();
    });

    it("switches sql and sheet, and format SQL", async () => {
        await $('[data-testid="project-item-anhinga"] span').click();
        await expect($('.CodeMirror')).toHaveText("1\nselect * from csv join albatross");
        await $('[data-testid="format-sql"] span').click();
        await expect($('.CodeMirror')).toHaveText("1\nselect\n2\n  *\n3\nfrom\n4\n  csv\n5\n  join albatross");
        await $('[data-testid="project-item-csv"] span').click();
        await expect($('.CodeMirror')).toHaveText("1\nSELECT * FROM \"csv\"");

        await $('[data-testid="view-csv"]').click();
        await expect($('[data-testid="sheet-section-item-csv"]')).toHaveElementClass(expect.stringContaining('selected'));
        await expect($('[data-testid="sheet-section-item-anhinga"]')).not.toHaveElementClass(expect.stringContaining('selected'));

        await $('[data-testid="view-anhinga"]').click();
        await expect($('[data-testid="sheet-section-item-anhinga"]')).toHaveElementClass(expect.stringContaining('selected'));
        await expect($('[data-testid="sheet-section-item-csv"]')).not.toHaveElementClass(expect.stringContaining('selected'));
    });

    it("quotes a table name", async () => {
        await expect($('.CodeMirror')).toHaveText("1\nSELECT * FROM \"csv\"");
        await $('[data-testid="quote-anhinga"]').click();
        await expect($('.CodeMirror')).toHaveText("1\nanhingaSELECT * FROM \"csv\"");
    });
});
