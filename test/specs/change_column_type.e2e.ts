import { $, expect } from '@wdio/globals'

describe('Change column type', () => {
  beforeAll(async () => {
    await browser.electron.execute(async (electron) => {
      electron.BrowserWindow.getAllWindows()[0].webContents.send('bypass-license')
    })
    await expect($('.toolbarSection')).toExist()
  })

  it('imports a csv', async () => {
    await $('.CodeMirror').click()
    await $('[data-testid="add-files"]').click()
    await $('[data-testid="input-file"]').clearValue()
    await $('[data-testid="input-file"]').addValue(await browser.uploadFile('./test/specs/csv-samples/column_detection.csv'))
    await $('[data-testid="import-all-files"]').click()

    await expect($('.sheet')).toHaveText(
      '1\n2012-12-01T03:45:23.000Z\n1.3\ntanin\n2012-12-01T03:45:00.000Z\n' +
      '2\n2014-02-28T13:45:23.000Z\n4\njohn\n2014-02-28T13:45:00.000Z\n' +
      'NULL\nNULL\nNULL\nNULL\nNULL\n' +
            ' id\ntime_with_seconds\nvalue\nname\nstripe_time_format\n' +
            '1\n2\n3'
    )
    await expect($('[data-testid="project-item-column_detection"] .fa-file-csv')).toExist()
  })

  it('validates the new type', async () => {
    await $('[data-testid="cell-0-1"]').click({ button: 'right' })
    await expect($('[data-testid="column-context-menu-column-type"]')).toHaveText('BIGINT')
    await $('[data-testid="column-context-menu-change-column-type"]').click()
    await $('.changing-column-type-dialog [data-testid="change-button"]').click()
    await expect($('.changing-column-type-dialog [data-testid="error"]')).toHaveText('You must select a new type.')
  })

  it('validates the timestamp format', async () => {
    await $('.changing-column-type-dialog [data-testid="new-type-selectbox"]').selectByVisibleText('TIMESTAMP')
    await $('.changing-column-type-dialog [data-testid="change-button"]').click()
    await expect($('.changing-column-type-dialog [data-testid="error"]')).toHaveText('You must select a timestamp format.')
  })

  it('validates invalid timestamp format', async () => {
    await $('.changing-column-type-dialog [data-testid="timestamp-format-selectbox"]').selectByVisibleText('%m/%d/%Y')
    await $('.changing-column-type-dialog [data-testid="change-button"]').click()
    await expect($('.changing-column-type-dialog [data-testid="error"]')).toHaveText("Binder Error: No function matches the given name and argument types 'strptime(BIGINT, STRING_LITERAL)'. You might need to add explicit type casts. Candidate functions: strptime(VARCHAR, VARCHAR) -> TIMESTAMP strptime(VARCHAR, VARCHAR[]) -> TIMESTAMP")
  })

  it('change the column to varchar and back', async () => {
    await $('.changing-column-type-dialog [data-testid="cancel-button"]').click()
    await $('[data-testid="cell-0-2"]').click({ button: 'right' })
    await expect($('[data-testid="column-context-menu-column-type"]')).toHaveText('TIMESTAMP')
    await $('[data-testid="column-context-menu-change-column-type"]').click()

    await $('.changing-column-type-dialog [data-testid="new-type-selectbox"]').selectByVisibleText('VARCHAR')
    await $('.changing-column-type-dialog [data-testid="change-button"]').click()

    await $('[data-testid="cell-0-2"]').click({ button: 'right' })
    await expect($('[data-testid="column-context-menu-column-type"]')).toHaveText('VARCHAR')
    await expect($('[data-testid="project-item-column_detection"] .fa-file-csv')).toExist() // The isCsv marker is not replaced.
    await $('[data-testid="column-context-menu-change-column-type"]').click()

    // Change it back
    await $('.changing-column-type-dialog [data-testid="new-type-selectbox"]').selectByVisibleText('TIMESTAMP')
    await $('.changing-column-type-dialog [data-testid="timestamp-format-selectbox"]').selectByVisibleText('%Y-%m-%d %H:%M:%S')
    await $('.changing-column-type-dialog [data-testid="change-button"]').click()

    await $('[data-testid="cell-0-2"]').click({ button: 'right' })
    await expect($('[data-testid="column-context-menu-column-type"]')).toHaveText('TIMESTAMP')
    await expect($('[data-testid="project-item-column_detection"] .fa-file-csv')).toExist() // The isCsv marker is not replaced.
  })

  it('checks that the 3rd column is double and 4th column is string', async () => {
    await $('[data-testid="cell-0-1"]').click() // clear the context menu
    await $('[data-testid="cell-0-3"]').click({ button: 'right' })
    await expect($('[data-testid="column-context-menu-column-type"]')).toHaveText('DOUBLE')

    await $('[data-testid="cell-0-1"]').click() // clear the context menu
    await $('[data-testid="cell-0-4"]').click({ button: 'right' })
    await expect($('[data-testid="column-context-menu-column-type"]')).toHaveText('VARCHAR')

    await $('[data-testid="cell-0-1"]').click() // clear the context menu
    await $('[data-testid="cell-0-5"]').click({ button: 'right' })
    await expect($('[data-testid="column-context-menu-column-type"]')).toHaveText('TIMESTAMP') // It can additionally detect the Stripe's timestamp format
  })
})
