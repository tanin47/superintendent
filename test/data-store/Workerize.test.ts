import fs from 'fs';
import path from "path";
import os from "os";
import {Workerize} from "../../src/data-store/Workerize";
import { DatabaseEngine, DatabaseEngines } from '../../src/types';
import { Result } from '../../src/data-store/Datastore';


DatabaseEngines.forEach((databaseEngine) => {
  describe(`Workerize: ${databaseEngine}`, () => {
    let workerize: Workerize;
    let exportedPath: string;

    beforeEach(async () => {
      exportedPath = path.join(os.tmpdir(), `exported.${new Date().getTime()}-${Math.random()}.csv`);
      workerize = (await Workerize.create(databaseEngine)) as Workerize;
      await workerize.open();
    });

    afterEach(async () =>{
      await workerize.close();
      if (fs.existsSync(exportedPath)) {
        fs.unlinkSync(exportedPath);
      }
    });

    describe('different formats', () => {
      const formats = [
        {filename: 'csv.csv', separator: ','},
        {filename: 'colon.csv', separator: ':'},
        {filename: 'semicolon.csv', separator: ';'},
        {filename: 'pipe.psv', separator: '|'},
        {filename: 'tab.tsv', separator: '\t'},
      ];

      for (const format of formats) {
        it(`Import ${format.filename}`, async () => {
          await workerize.addCsv(`./test/data-store/csv-samples/${format.filename}`, true, format.separator, '');

          const table = format.filename.split('.')[0];
          const sql = `SELECT * FROM ${table}`;
          const result = await workerize.query(sql, null);

          expect(result).toEqual(
            {
              count: 2,
              columns: [{name: 'firstname', maxCharWidthCount: 8}, {name: 'last_quote_name', maxCharWidthCount: 17}, {name: 'email', maxCharWidthCount: 33}],
              name: expect.any(String),
              sql,
              rows: [
                ['Harmonia', 'Waite', 'Har"quote"monia.Waite@yopmail.com'],
                ['Joy', `something${format.separator}another`, 'Joy.Haerr@yopmail.com']
              ],
              isCsv: false,
            }
          );
        });
      }
    });

    if (databaseEngine === 'sqlite') {
      it("imports CSV with no header and incomplete line", async () => {
        await workerize.addCsv(`./test/data-store/csv-samples/tilde_incomplete_line_no_header.csv`, false, '~', '');

        const sql = "SELECT * FROM tilde_incomplete_line_no_header";
        const result = await workerize.query(sql, null);

        const expectedRows = [
          ["test", "last", "1234", "usa", "50", "male"],
          ["test", "last", "1234", "usa", "50", null],
          ["test", "last", "1234", "usa", null, null],
          ["test", "last", "1234", null, null, null],
          ["test", "last", null, null, null, null],
          ["test", null, null, null, null, null],
          ["test", "last", "1234", "usa", "50", "male"]
        ]

        expect(result.columns.length).toEqual(6);
        expect(result.sql).toEqual(sql);
        expect(result.count).toEqual(expectedRows.length);
        expect(result.rows).toEqual(expectedRows);
      });
    }

    describe('import/export', () => {
      it('import bom', async () => {
        await workerize.addCsv('./test/data-store/csv-samples/bom.csv', true, ',', '');
        const result = await workerize.query("SELECT * FROM bom", null);

        expect(result).toEqual(
          {
            count: 1,
            columns: [{name: 'bom_column_1', maxCharWidthCount: 6}, {name: 'bom_column_2', maxCharWidthCount: 6}],
            name: expect.any(String),
            sql: "SELECT * FROM bom",
            rows: [['value1', 'value2']],
            isCsv: false,
          }
        );

        await workerize.exportCsv('bom', exportedPath, ',');
        expect(fs.readFileSync(exportedPath, {encoding: 'utf8'})).toEqual(
          'bom_column_1,bom_column_2\nvalue1,value2\n'
        );
      });

      it('import dup column names', async () => {
        await workerize.addCsv('./test/data-store/csv-samples/dup_column.csv', true, ',', '');
        const result = await workerize.query("SELECT * FROM dup_column", null);

        expect(result).toEqual(
          {
            count: 1,
            columns: [{name: 'name', maxCharWidthCount: 4}, {name: 'Name_dup', maxCharWidthCount: 7}],
            name: expect.any(String),
            sql: "SELECT * FROM dup_column",
            rows: [['john', 'doe, do']],
            isCsv: false,
          }
        );
        await workerize.exportCsv('dup_column', exportedPath, ',');
        expect(fs.readFileSync(exportedPath, {encoding: 'utf8'})).toEqual(
          'name,Name_dup\njohn,"doe, do"\n'
        );
      });

      it('import unicode', async () => {
        await workerize.addCsv('./test/data-store/csv-samples/unicode.csv', true, ',', '');
        const result = await workerize.query("SELECT * FROM unicode", null);

        expect(result).toEqual(
          {
            count: 1,
            columns: [{name: 'something', maxCharWidthCount: 5}, {name: 'another', maxCharWidthCount: 5}],
            name: expect.any(String),
            sql: "SELECT * FROM unicode",
            rows: [['ก ไก่', 'ข ไข่']],
            isCsv: false,
          }
        );
        await workerize.exportCsv('unicode', exportedPath, ',');

        let expectedContent: string;

        if (databaseEngine === 'sqlite') {
          expectedContent = 'something,another\n"ก ไก่","ข ไข่"\n'
      } else if (databaseEngine === 'duckdb') {
          expectedContent = 'something,another\nก ไก่,ข ไข่\n'
      } else {
        throw new Error()
      }

        expect(fs.readFileSync(exportedPath, {encoding: 'utf8'})).toEqual(expectedContent);
      });

      it('import quote', async () => {
        await workerize.addCsv('./test/data-store/csv-samples/quote.csv', true, ',', '');
        const result = await workerize.query("SELECT * FROM quote", null);

        let expectedResult: any;
        let expectedContent: string;

        if (databaseEngine === 'sqlite') {
            expectedResult = {
              count: 2,
              columns: [{name: 'first_name', maxCharWidthCount: 17}, {name: 'last_name', maxCharWidthCount: 10}, {name: 'email', maxCharWidthCount: 15}],
              name: expect.any(String),
              sql: "SELECT * FROM quote",
              rows: [
                ['john', 'doe, do', ' "test@doe.com"'],
                ['nanakorn, " tanin', ' somename ', 'some email'],
              ],
              isCsv: false,
            }
            expectedContent = 'first_name,last_name,email\njohn,"doe, do"," ""test@doe.com"""\n"nanakorn, "" tanin"," somename ","some email"\n'
        } else if (databaseEngine === 'duckdb') {
            expectedResult = {
              count: 2,
              columns: [{name: 'first_name', maxCharWidthCount: 17}, {name: 'last_name', maxCharWidthCount: 10}, {name: 'email', maxCharWidthCount: 12}],
              name: expect.any(String),
              sql: "SELECT * FROM quote",
              rows: [
                ['john', 'doe, do', 'test@doe.com'],
                ['nanakorn, " tanin', ' somename ', 'some email'],
              ],
              isCsv: false,
            }
            expectedContent = 'first_name,last_name,email\njohn,"doe, do",test@doe.com\n"nanakorn, "" tanin", somename ,some email\n'
        } else {
          throw new Error()
        }

        expect(result).toEqual(expectedResult);

        await workerize.exportCsv('quote', exportedPath, ',');
        expect(fs.readFileSync(exportedPath, {encoding: 'utf8'})).toEqual(expectedContent);
      });
    });

    if (databaseEngine === 'sqlite') {
      describe('regex_replace', () => {
        it('handle null', async () => {
          const result = await workerize.query("SELECT regex_replace('[0-9]+', NULL, '0', false) AS month", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'month', maxCharWidthCount: 0 }],
              name: expect.any(String),
              sql: "SELECT regex_replace('[0-9]+', NULL, '0', false) AS month",
              rows: [[null]],
              isCsv: false,
            }
          );
        });

        it('replace only once', async () => {
          const result = await workerize.query("SELECT regex_replace('[0-9]+', '123.456.789', '00', true) AS month", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'month', maxCharWidthCount: 10 }],
              name: expect.any(String),
              sql: "SELECT regex_replace('[0-9]+', '123.456.789', '00', true) AS month",
              rows: [['00.456.789']],
              isCsv: false,
            }
          );
        });

        it('replace all', async () => {
          const result = await workerize.query("SELECT regex_replace('[0-9]+', '123.456.789', '00', false) AS month", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'month', maxCharWidthCount: 8 }],
              name: expect.any(String),
              sql: "SELECT regex_replace('[0-9]+', '123.456.789', '00', false) AS month",
              rows: [['00.00.00']],
              isCsv: false,
            }
          );
        });

        it('invalid regex', async () => {
          const result = await workerize.query("SELECT regex_replace('([0-9+)/([0-9]+/([0-9]+', 'abcd', '00', false) AS month", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'month', maxCharWidthCount: 0 }],
              name: expect.any(String),
              sql: "SELECT regex_replace('([0-9+)/([0-9]+/([0-9]+', 'abcd', '00', false) AS month",
              rows: [[null]],
              isCsv: false,
            }
          );
        });
      });

      describe('regex_extract', () => {
        it('handle null', async () => {
          const result = await workerize.query("SELECT regex_extract('[0-9]+', NULL) AS month", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'month', maxCharWidthCount: 0 }],
              name: expect.any(String),
              sql: "SELECT regex_extract('[0-9]+', NULL) AS month",
              rows: [[null]],
              isCsv: false,
            }
          );
        });

        it('extract date', async () => {
          const result = await workerize.query("SELECT regex_extract('[0-9]+/([0-9]+)/[0-9]+', '3/7/2019') AS month", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'month', maxCharWidthCount: 1 }],
              name: expect.any(String),
              sql: "SELECT regex_extract('[0-9]+/([0-9]+)/[0-9]+', '3/7/2019') AS month",
              rows: [['7']],
              isCsv: false,
            }
          );
        });

        it('multiple extracts', async () => {
          const result = await workerize.query("SELECT regex_extract('([0-9]+)/([0-9]+)/([0-9]+)', '3/7/2019') AS month", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'month', maxCharWidthCount: 1 }],
              name: expect.any(String),
              sql: "SELECT regex_extract('([0-9]+)/([0-9]+)/([0-9]+)', '3/7/2019') AS month",
              rows: [['3']],
              isCsv: false,
            }
          );
        });

        it('does not match', async () => {
          const result = await workerize.query("SELECT regex_extract('([0-9]+)/([0-9]+)/([0-9]+)', 'abcd') AS month", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'month', maxCharWidthCount: 0 }],
              name: expect.any(String),
              sql: "SELECT regex_extract('([0-9]+)/([0-9]+)/([0-9]+)', 'abcd') AS month",
              rows: [[null]],
              isCsv: false,
            }
          );
        });

        it('invalid regex', async () => {
          const result = await workerize.query("SELECT regex_extract('([0-9+)/([0-9]+/([0-9]+', 'abcd') AS month", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'month', maxCharWidthCount: 0 }],
              name: expect.any(String),
              sql: "SELECT regex_extract('([0-9+)/([0-9]+/([0-9]+', 'abcd') AS month",
              rows: [[null]],
              isCsv: false,
            }
          );
        });
      });

      describe('date_parse', () => {
        it('handles null', async () => {
          const result = await workerize.query("SELECT date_parse('%m/%d/%Y', NULL) AS date", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'date', maxCharWidthCount: 0 }],
              name: expect.any(String),
              sql: "SELECT date_parse('%m/%d/%Y', NULL) AS date",
              rows: [[null]],
              isCsv: false,
            }
          );
        });
        it('parse date', async () => {
          const result = await workerize.query("SELECT date_parse('%m/%d/%Y', '3/7/2019') AS date", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'date', maxCharWidthCount: 10 }],
              name: expect.any(String),
              sql: "SELECT date_parse('%m/%d/%Y', '3/7/2019') AS date",
              rows: [['2019-03-07']],
              isCsv: false,
            }
          );
        });

        it('parse date time', async () => {
          const result = await workerize.query("SELECT date_parse('%m/%d/%Y %I:%M %p', '3/7/2019 7:12 pm') AS date", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'date', maxCharWidthCount: 24 }],
              name: expect.any(String),
              sql: "SELECT date_parse('%m/%d/%Y %I:%M %p', '3/7/2019 7:12 pm') AS date",
              rows: [['2019-03-07T19:12:00.000Z']],
              isCsv: false,
            }
          );
        });

        it('invalid value', async () => {
          const result = await workerize.query("SELECT date_parse('%m/%d/%Y %I:%M %p', 'abcd') AS date", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'date', maxCharWidthCount: 0 }],
              name: expect.any(String),
              sql: "SELECT date_parse('%m/%d/%Y %I:%M %p', 'abcd') AS date",
              rows: [[null]],
              isCsv: false,
            }
          );
        });

        it('invalid format', async () => {
          const result = await workerize.query("SELECT date_parse('%uslkajf%n', '3/7/2019 7:12 pm') AS date", null);

          expect(result).toEqual(
            {
              count: 1,
              columns: [{ name: 'date', maxCharWidthCount: 0 }],
              name: expect.any(String),
              sql: "SELECT date_parse('%uslkajf%n', '3/7/2019 7:12 pm') AS date",
              rows: [[null]],
              isCsv: false,
            }
          );
        });
      });
    }
  });
});
