import fs from 'fs'
import path from 'path'
import os from 'os'
import { Workerize } from '../../src/data-store/Workerize'

describe('Workerize', () => {
  let workerize: Workerize
  let exportedPath: string

  beforeEach(async () => {
    exportedPath = path.join(os.tmpdir(), `exported.${new Date().getTime()}-${Math.random()}.csv`)
    workerize = (await Workerize.create()) as Workerize
    await workerize.open()
  })

  afterEach(async () => {
    await workerize.close()
    if (fs.existsSync(exportedPath)) {
      fs.unlinkSync(exportedPath)
    }
  })

  describe('different formats', () => {
    const formats = [
      { filename: 'csv.csv', separator: ',' },
      { filename: 'colon.csv', separator: ':' },
      { filename: 'semicolon.csv', separator: ';' },
      { filename: 'pipe.psv', separator: '|' },
      { filename: 'tab.tsv', separator: '\t' }
    ]

    for (const format of formats) {
      it(`Import ${format.filename}`, async () => {
        await workerize.addCsv(`./test/data-store/csv-samples/${format.filename}`, true, format.separator, '', true)

        const table = format.filename.split('.')[0]
        const sql = `SELECT * FROM ${table}`
        const result = await workerize.query(sql, null)

        await expect(result).toEqual(
          {
            count: 2,
            columns: [
              { name: 'firstname', maxCharWidthCount: 8, tpe: 'varchar' },
              { name: 'last_quote_name', maxCharWidthCount: 17, tpe: 'varchar' },
              { name: 'email', maxCharWidthCount: 33, tpe: 'varchar' }
            ],
            name: expect.any(String),
            sql,
            rows: [
              ['Harmonia', 'Waite', 'Har"quote"monia.Waite@yopmail.com'],
              ['Joy', `something${format.separator}another`, 'Joy.Haerr@yopmail.com']
            ]
          }
        )
      })
    }
  })

  it('handles empty column name', async () => {
    await workerize.addCsv('./test/data-store/csv-samples/empty_header.csv', true, ',', '', true)

    const sql = 'SELECT * FROM empty_header'
    const result = await workerize.query(sql, null)

    await expect(result).toEqual(
      {
        count: 1,
        columns: [
          { name: 'empty', maxCharWidthCount: 3, tpe: 'varchar' },
          { name: 'name', maxCharWidthCount: 5, tpe: 'varchar' },
          { name: 'something', maxCharWidthCount: 7, tpe: 'varchar' }
        ],
        name: expect.any(String),
        sql,
        rows: [
          ['row', 'tanin', 'nothing']
        ]
      }
    )
  })

  describe('import/export', () => {
    it('import bom', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/bom.csv', true, ',', '', true)
      const result = await workerize.query('SELECT * FROM bom', null)

      await expect(result).toEqual(
        {
          count: 1,
          columns: [{ name: 'bom_column_1', maxCharWidthCount: 6 }, { name: 'bom_column_2', maxCharWidthCount: 6 }],
          name: expect.any(String),
          sql: 'SELECT * FROM bom',
          rows: [['value1', 'value2']],
          isCsv: false
        }
      )

      await workerize.exportCsv('bom', exportedPath, ',')
      await expect(fs.readFileSync(exportedPath, { encoding: 'utf8' })).toEqual(
        'bom_column_1,bom_column_2\nvalue1,value2\n'
      )
    })

    it('import dup column names', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/dup_column.csv', true, ',', '', true)
      const result = await workerize.query('SELECT * FROM dup_column', null)

      await expect(result).toEqual(
        {
          count: 1,
          columns: [{ name: 'name', maxCharWidthCount: 4 }, { name: 'Name_dup', maxCharWidthCount: 7 }],
          name: expect.any(String),
          sql: 'SELECT * FROM dup_column',
          rows: [['john', 'doe, do']],
          isCsv: false
        }
      )
      await workerize.exportCsv('dup_column', exportedPath, ',')
      await expect(fs.readFileSync(exportedPath, { encoding: 'utf8' })).toEqual(
        'name,Name_dup\njohn,"doe, do"\n'
      )
    })

    it('import unicode', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/unicode.csv', true, ',', '', true)
      const result = await workerize.query('SELECT * FROM unicode', null)

      await expect(result).toEqual(
        {
          count: 1,
          columns: [{ name: 'something', maxCharWidthCount: 5 }, { name: 'another', maxCharWidthCount: 5 }],
          name: expect.any(String),
          sql: 'SELECT * FROM unicode',
          rows: [['ก ไก่', 'ข ไข่']],
          isCsv: false
        }
      )
      await workerize.exportCsv('unicode', exportedPath, ',')

      const expectedContent = 'something,another\nก ไก่,ข ไข่\n'

      await expect(fs.readFileSync(exportedPath, { encoding: 'utf8' })).toEqual(expectedContent)
    })

    it('import quote', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/quote.csv', true, ',', '', true)
      const result = await workerize.query('SELECT * FROM quote', null)

      const expectedResult = {
        count: 2,
        columns: [{ name: 'first_name', maxCharWidthCount: 17 }, { name: 'last_name', maxCharWidthCount: 10 }, { name: 'email', maxCharWidthCount: 12 }],
        name: expect.any(String),
        sql: 'SELECT * FROM quote',
        rows: [
          ['john', 'doe, do', 'test@doe.com'],
          ['nanakorn, " tanin', ' somename ', 'some email']
        ],
        isCsv: false
      }
      const expectedContent = 'first_name,last_name,email\njohn,"doe, do",test@doe.com\n"nanakorn, "" tanin", somename ,some email\n'

      await expect(result).toEqual(expectedResult)

      await workerize.exportCsv('quote', exportedPath, ',')
      await expect(fs.readFileSync(exportedPath, { encoding: 'utf8' })).toEqual(expectedContent)
    })
  })
})
