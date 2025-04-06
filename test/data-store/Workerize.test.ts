import fs from 'fs'
import path from 'path'
import os from 'os'
import { Workerize } from '../../src/data-store/Workerize'
import { type QueryColumn } from '../../src/types'

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

        expect(result).toEqual(
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

    expect(result).toEqual(
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
    it('import autodetect', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/auto_detect_bug.csv', true, ',', '', true)
      const result = await workerize.query('SELECT * FROM auto_detect_bug', null)

      expect(result.count).toEqual(2)
    })

    it('import bom', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/bom.csv', true, ',', '', true)
      const result = await workerize.query('SELECT * FROM bom', null)

      expect(result).toEqual(
        {
          count: 1,
          columns: [{ name: 'bom_column_1', tpe: 'varchar', maxCharWidthCount: 6 }, { name: 'rowid_dup', tpe: 'bigint', maxCharWidthCount: 3 }],
          name: expect.any(String),
          sql: 'SELECT * FROM bom',
          rows: [['value1', BigInt(123)]]
        }
      )

      await workerize.exportCsv('bom', exportedPath, ',')
      expect(fs.readFileSync(exportedPath, { encoding: 'utf8' })).toEqual(
        'bom_column_1,rowid_dup\nvalue1,123\n'
      )
    })

    it('can handle null padding and quote new line at the same time', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/null_padding_quote_new_line.csv', true, ',', '', true)
      const result = await workerize.query('SELECT * FROM null_padding_quote_new_line', null)

      expect(result).toEqual(
        {
          count: 3,
          columns: [
            { name: 'name', tpe: 'varchar', maxCharWidthCount: 5 },
            { name: 'address', tpe: 'varchar', maxCharWidthCount: 10 },
            { name: 'something', tpe: 'varchar', maxCharWidthCount: 4 }
          ],
          name: expect.any(String),
          sql: 'SELECT * FROM null_padding_quote_new_line',
          rows: [
            ['tanin', 'multi\nline', 'yoyo'],
            ['yes', 'no', null],
            ['well', null, null]
          ]
        }
      )
      await workerize.exportCsv('null_padding_quote_new_line', exportedPath, ',')
      expect(fs.readFileSync(exportedPath, { encoding: 'utf8' })).toEqual(
        [
          'name,address,something',
          'tanin,"multi',
          'line",yoyo',
          'yes,no,',
          'well,,',
          ''
        ].join('\n')
      )
    })

    it('supports all formats of dates', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/dates.csv', true, ',', '', true)
      const result = await workerize.query('SELECT * FROM "dates"', null)

      result.rows[0] = result.rows[0].map((r) => {
        try {
          return (r as Date).toISOString()
        } catch (_e) {
          return r
        }
      })

      const expectedColumns: QueryColumn[] = []
      const expectedRow: string[] = []
      for (let i = 1; i <= 20; i++) {
        expectedColumns.push({ name: `date${i}`, tpe: 'timestamp', maxCharWidthCount: 25 })

        let time = '2024-02-01'
        if (i === 1) {
          time = '2024-02-01T11:22:33Z'
        } else if (i === 2) {
          time = '2024-02-01T11:22Z'
        }

        expectedRow.push(new Date(Date.parse(time)).toISOString())
      }

      expect(result).toEqual(
        {
          count: 1,
          columns: expectedColumns,
          name: expect.any(String),
          sql: 'SELECT * FROM "dates"',
          rows: [expectedRow]
        }
      )
      await workerize.exportCsv('dates', exportedPath, ',')
      expect(fs.readFileSync(exportedPath, { encoding: 'utf8' })).toEqual(
        [
          expectedColumns.map((c) => c.name).join(','),
          expectedRow.map((r) => r.replace('T', ' ').replace('.000Z', '')),
          ''
        ].join('\n')
      )
    })

    it('supports hugeint; it uses double', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/hugeint.csv', true, ',', '', true)
      const result = await workerize.query('SELECT * FROM "hugeint"', null)

      expect(result).toEqual(
        {
          count: 2,
          columns: [
            { name: 'name', tpe: 'varchar', maxCharWidthCount: 5 },
            { name: 'number', tpe: 'double', maxCharWidthCount: 22 }
          ],
          name: expect.any(String),
          sql: 'SELECT * FROM "hugeint"',
          rows: [
            ['tanin', 1.7014118346046923e+38],
            ['test', 1.6014118346046923e+38]
          ]
        }
      )
      await workerize.exportCsv('hugeint', exportedPath, ',')
      expect(fs.readFileSync(exportedPath, { encoding: 'utf8' })).toEqual(
        [
          'name,number',
          'tanin,1.7014118346046923e+38',
          'test,1.6014118346046923e+38',
          ''
        ].join('\n')
      )
    })

    it('import dup column names', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/dup_column.csv', true, ',', '', true)
      const result = await workerize.query('SELECT * FROM dup_column', null)

      expect(result).toEqual(
        {
          count: 1,
          columns: [{ name: 'name', tpe: 'varchar', maxCharWidthCount: 4 }, { name: 'Name_dup', tpe: 'varchar', maxCharWidthCount: 7 }],
          name: expect.any(String),
          sql: 'SELECT * FROM dup_column',
          rows: [['john', 'doe, do']]
        }
      )
      await workerize.exportCsv('dup_column', exportedPath, ',')
      expect(fs.readFileSync(exportedPath, { encoding: 'utf8' })).toEqual(
        'name,Name_dup\njohn,"doe, do"\n'
      )
    })

    it('import unicode', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/unicode.csv', true, ',', '', true)
      const result = await workerize.query('SELECT * FROM unicode', null)

      expect(result).toEqual(
        {
          count: 1,
          columns: [
            { name: 'something', tpe: 'varchar', maxCharWidthCount: 5 },
            { name: 'another', tpe: 'varchar', maxCharWidthCount: 5 },
            { name: 'other', tpe: 'varchar', maxCharWidthCount: 13 }
          ],
          name: expect.any(String),
          sql: 'SELECT * FROM unicode',
          rows: [['ก ไก่', 'ข ไข่', 'Neuchâteloise']]
        }
      )
      await workerize.exportCsv('unicode', exportedPath, ',')

      const expectedContent = 'something,another,other\nก ไก่,ข ไข่,Neuchâteloise\n'

      expect(fs.readFileSync(exportedPath, { encoding: 'utf8' })).toEqual(expectedContent)
    })

    it('import quote', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/quote.csv', true, ',', '', true)
      const result = await workerize.query('SELECT * FROM quote', null)

      const expectedResult = {
        count: 2,
        columns: [{ name: 'first_name', tpe: 'varchar', maxCharWidthCount: 18 }, { name: 'last_name', tpe: 'varchar', maxCharWidthCount: 10 }, { name: 'email', tpe: 'varchar', maxCharWidthCount: 12 }],
        name: expect.any(String),
        sql: 'SELECT * FROM quote',
        rows: [
          ['john', 'doe, do', 'test@doe.com'],
          ['nanakorn, "" tanin', ' somename ', 'some email']
        ]
      }
      const expectedContent = 'first_name,last_name,email\njohn,"doe, do",test@doe.com\n"nanakorn, """" tanin", somename ,some email\n'

      expect(result).toEqual(expectedResult)

      await workerize.exportCsv('quote', exportedPath, ',')
      expect(fs.readFileSync(exportedPath, { encoding: 'utf8' })).toEqual(expectedContent)
    })
  })
})
