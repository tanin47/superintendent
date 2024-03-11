import {$, expect} from '@wdio/globals'
import {Key} from 'webdriverio'
import {clearEditor, expectDefaultEditorText, getTabs} from "./helpers";

describe('Change column type', () => {
    beforeAll(async () => {
        await browser.electron.execute(async (electron) => {
            electron.BrowserWindow.getAllWindows()[0].webContents.send('bypass-license');
        });
        await expect($('.toolbarSection')).toExist();
    });

    it('create a table', async () => {
        await $('.CodeMirror').click();
        await browser.keys("select 123, '2022-10-04', 3.14");
        await $('[data-testid="run-sql"]').click();
        await expect($('.sheet')).toHaveText(
            "123\n2022-10-04\n3.14\n" +
            " 123\n'2022-10-04'\n3.14\n" + 
            "1"
        );
    });

    it("validates the new type", async () => {
        await $('[data-testid="cell-0-1"]').click({button: 'right'});
        await expect($('[data-testid="column-context-menu-column-type"]')).toHaveText('BIGINT')
        await $('[data-testid="column-context-menu-change-column-type"]').click();
        await $('.changing-column-type-dialog [data-testid="change-button"]').click();
        await expect($('.changing-column-type-dialog [data-testid="error"]')).toHaveText('You must select a new type.')
    });

    it("validates the timestamp format", async () => {
        await $('.changing-column-type-dialog [data-testid="new-type-selectbox"]').selectByVisibleText('TIMESTAMP')
        await $('.changing-column-type-dialog [data-testid="change-button"]').click();
        await expect($('.changing-column-type-dialog [data-testid="error"]')).toHaveText('You must select a timestamp format.')
    });

    it("validates invalid timestamp format", async () => {
        await $('.changing-column-type-dialog [data-testid="timestamp-format-selectbox"]').selectByVisibleText('%m/%d/%Y')
        await $('.changing-column-type-dialog [data-testid="change-button"]').click();
        await expect($('.changing-column-type-dialog [data-testid="error"]')).toHaveText("Binder Error: No function matches the given name and argument types 'strptime(BIGINT, STRING_LITERAL)'. You might need to add explicit type casts. Candidate functions: strptime(VARCHAR, VARCHAR) -> TIMESTAMP strptime(VARCHAR, VARCHAR[]) -> TIMESTAMP")
    });

    it("change the column to timestamp", async () => {
        await $('.changing-column-type-dialog [data-testid="cancel-button"]').click();
        await $('[data-testid="cell-0-2"]').click({button: 'right'});
        await expect($('[data-testid="column-context-menu-column-type"]')).toHaveText('VARCHAR')
        await $('[data-testid="column-context-menu-change-column-type"]').click();

        await $('.changing-column-type-dialog [data-testid="new-type-selectbox"]').selectByVisibleText('TIMESTAMP')
        await $('.changing-column-type-dialog [data-testid="timestamp-format-selectbox"]').selectByVisibleText('%Y-%m-%d')
        await $('.changing-column-type-dialog [data-testid="change-button"]').click();

        await $('[data-testid="cell-0-2"]').click({button: 'right'});
        await expect($('[data-testid="column-context-menu-column-type"]')).toHaveText('TIMESTAMP')
    });
});
