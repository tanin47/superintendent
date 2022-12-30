import fs from 'fs';
import path from "path";
import os from "os";
import {Workerize} from "../../src/data-store/Workerize";

describe('Workerize', () => {
  let workerize: Workerize;
  let exportedPath: string;

  beforeEach(async () => {
    exportedPath = path.join(os.tmpdir(), `exported.${new Date().getTime()}-${Math.random()}.csv`);
    workerize = (await Workerize.create()) as Workerize;
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
        await workerize.addCsv(`./test/data-store/csv-samples/${format.filename}`, true, format.separator, false);

        const sql = `SELECT * FROM ${format.filename.split('.')[0]}`;
        const result = await workerize.query(sql);

        expect(result).toEqual(
          {
            count: 2,
            columns: [{name: 'firstname', maxCharWidthCount: 8}, {name: 'last_quote_name', maxCharWidthCount: 17}, {name: 'email', maxCharWidthCount: 33}],
            name: expect.any(String),
            sql,
            rows: [
              ['Harmonia', 'Waite', 'Har"quote"monia.Waite@yopmail.com'],
              ['Joy', `something${format.separator}another`, 'Joy.Haerr@yopmail.com']
            ]
          }
        );
      });
    }
  });

  it("imports CSV with no header and incomplete line", async () => {
    await workerize.addCsv(`./test/data-store/csv-samples/tilde_incomplete_line_no_header.csv`, false, '~', false);

    const sql = "SELECT * FROM tilde_incomplete_line_no_header";
    const result = await workerize.query(sql);

    expect(result.count).toEqual(7);
    expect(result.columns.length).toEqual(6);
    expect(result.sql).toEqual(sql);
    expect(result.rows).toEqual([
      ["test", "last", "1234", "usa", "50", "male"],
      ["test", "last", "1234", "usa", "50", null],
      ["test", "last", "1234", "usa", null, null],
      ["test", "last", "1234", null, null, null],
      ["test", "last", null, null, null, null],
      ["test", null, null, null, null, null],
      ["test", "last", "1234", "usa", "50", "male"]
    ]);
  });

  describe('import/export', () => {
    it('import bom', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/bom.csv', true, ',', false);
      const result = await workerize.query("SELECT * FROM bom");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'bom_column_1', maxCharWidthCount: 6}, {name: 'bom_column_2', maxCharWidthCount: 6}],
          name: expect.any(String),
          sql: "SELECT * FROM bom",
          rows: [['value1', 'value2']]
        }
      );

      await workerize.exportCsv('bom', exportedPath);
      expect(fs.readFileSync(exportedPath, {encoding: 'utf8'})).toEqual(
        'bom_column_1,bom_column_2\r\nvalue1,value2\r\n'
      );
    });

    it('import dup column names', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/dup_column.csv', true, ',', false);
      const result = await workerize.query("SELECT * FROM dup_column");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'name', maxCharWidthCount: 4}, {name: 'Name_dup', maxCharWidthCount: 7}],
          name: expect.any(String),
          sql: "SELECT * FROM dup_column",
          rows: [['john', 'doe, do']]
        }
      );
      await workerize.exportCsv('dup_column', exportedPath);
      expect(fs.readFileSync(exportedPath, {encoding: 'utf8'})).toEqual(
        'name,Name_dup\r\njohn,"doe, do"\r\n'
      );
    });

    it('import unicode', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/unicode.csv', true, ',', false);
      const result = await workerize.query("SELECT * FROM unicode");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'something', maxCharWidthCount: 5}, {name: 'another', maxCharWidthCount: 5}],
          name: expect.any(String),
          sql: "SELECT * FROM unicode",
          rows: [['ก ไก่', 'ข ไข่']]
        }
      );
      await workerize.exportCsv('unicode', exportedPath);
      expect(fs.readFileSync(exportedPath, {encoding: 'utf8'})).toEqual(
        'something,another\r\n"ก ไก่","ข ไข่"\r\n'
      );
    });

    it('import quote', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/quote.csv', true, ',', false);
      const result = await workerize.query("SELECT * FROM quote");

      expect(result).toEqual(
        {
          count: 2,
          columns: [{name: 'first_name', maxCharWidthCount: 17}, {name: 'last_name', maxCharWidthCount: 10}, {name: 'email', maxCharWidthCount: 15}],
          name: expect.any(String),
          sql: "SELECT * FROM quote",
          rows: [
            ['john', 'doe, do', ' "test@doe.com"'],
            ['nanakorn, " tanin', ' somename ', 'some email'],
          ]
        }
      );

      await workerize.exportCsv('quote', exportedPath);
      expect(fs.readFileSync(exportedPath, {encoding: 'utf8'})).toEqual(
        'first_name,last_name,email\r\njohn,"doe, do"," ""test@doe.com"""\r\n"nanakorn, "" tanin"," somename ","some email"\r\n'
      );
    });
  });

  describe('regex_replace', () => {
    it('handle null', async () => {
      const result = await workerize.query("SELECT regex_replace('[0-9]+', NULL, '0', false) AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'month', maxCharWidthCount: 0}],
          name: expect.any(String),
          sql: "SELECT regex_replace('[0-9]+', NULL, '0', false) AS month",
          rows: [[null]]
        }
      );
    });

    it('replace only once', async () => {
      const result = await workerize.query("SELECT regex_replace('[0-9]+', '123.456.789', '00', true) AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'month', maxCharWidthCount: 10}],
          name: expect.any(String),
          sql: "SELECT regex_replace('[0-9]+', '123.456.789', '00', true) AS month",
          rows: [['00.456.789']]
        }
      );
    });

    it('replace all', async () => {
      const result = await workerize.query("SELECT regex_replace('[0-9]+', '123.456.789', '00', false) AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'month', maxCharWidthCount: 8}],
          name: expect.any(String),
          sql: "SELECT regex_replace('[0-9]+', '123.456.789', '00', false) AS month",
          rows: [['00.00.00']]
        }
      );
    });

    it('invalid regex', async () => {
      const result = await workerize.query("SELECT regex_replace('([0-9+)/([0-9]+/([0-9]+', 'abcd', '00', false) AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'month', maxCharWidthCount: 0}],
          name: expect.any(String),
          sql: "SELECT regex_replace('([0-9+)/([0-9]+/([0-9]+', 'abcd', '00', false) AS month",
          rows: [[null]]
        }
      );
    });
  });

  describe('regex_extract', () => {
    it('handle null', async () => {
      const result = await workerize.query("SELECT regex_extract('[0-9]+', NULL) AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'month', maxCharWidthCount: 0}],
          name: expect.any(String),
          sql: "SELECT regex_extract('[0-9]+', NULL) AS month",
          rows: [[null]]
        }
      );
    });

    it('extract date', async () => {
      const result = await workerize.query("SELECT regex_extract('[0-9]+/([0-9]+)/[0-9]+', '3/7/2019') AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'month', maxCharWidthCount: 1}],
          name: expect.any(String),
          sql: "SELECT regex_extract('[0-9]+/([0-9]+)/[0-9]+', '3/7/2019') AS month",
          rows: [['7']]
        }
      );
    });

    it('multiple extracts', async () => {
      const result = await workerize.query("SELECT regex_extract('([0-9]+)/([0-9]+)/([0-9]+)', '3/7/2019') AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'month', maxCharWidthCount: 1}],
          name: expect.any(String),
          sql: "SELECT regex_extract('([0-9]+)/([0-9]+)/([0-9]+)', '3/7/2019') AS month",
          rows: [['3']]
        }
      );
    });

    it('does not match', async () => {
      const result = await workerize.query("SELECT regex_extract('([0-9]+)/([0-9]+)/([0-9]+)', 'abcd') AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'month', maxCharWidthCount: 0}],
          name: expect.any(String),
          sql: "SELECT regex_extract('([0-9]+)/([0-9]+)/([0-9]+)', 'abcd') AS month",
          rows: [[null]]
        }
      );
    });

    it('invalid regex', async () => {
      const result = await workerize.query("SELECT regex_extract('([0-9+)/([0-9]+/([0-9]+', 'abcd') AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'month', maxCharWidthCount: 0}],
          name: expect.any(String),
          sql: "SELECT regex_extract('([0-9+)/([0-9]+/([0-9]+', 'abcd') AS month",
          rows: [[null]]
        }
      );
    });
  });

  describe('date_parse', () => {
    it('handles null', async () => {
      const result = await workerize.query("SELECT date_parse('%m/%d/%Y', NULL) AS date");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'date', maxCharWidthCount: 0}],
          name: expect.any(String),
          sql: "SELECT date_parse('%m/%d/%Y', NULL) AS date",
          rows: [[null]]
        }
      );
    });
    it('parse date', async () => {
      const result = await workerize.query("SELECT date_parse('%m/%d/%Y', '3/7/2019') AS date");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'date', maxCharWidthCount: 10}],
          name: expect.any(String),
          sql: "SELECT date_parse('%m/%d/%Y', '3/7/2019') AS date",
          rows: [['2019-03-07']]
        }
      );
    });

    it('parse date time', async () => {
      const result = await workerize.query("SELECT date_parse('%m/%d/%Y %I:%M %p', '3/7/2019 7:12 pm') AS date");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'date', maxCharWidthCount: 24}],
          name: expect.any(String),
          sql: "SELECT date_parse('%m/%d/%Y %I:%M %p', '3/7/2019 7:12 pm') AS date",
          rows: [['2019-03-07T19:12:00.000Z']]
        }
      );
    });

    it('invalid value', async () => {
      const result = await workerize.query("SELECT date_parse('%m/%d/%Y %I:%M %p', 'abcd') AS date");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'date', maxCharWidthCount: 0}],
          name: expect.any(String),
          sql: "SELECT date_parse('%m/%d/%Y %I:%M %p', 'abcd') AS date",
          rows: [[null]]
        }
      );
    });

    it('invalid format', async () => {
      const result = await workerize.query("SELECT date_parse('%uslkajf%n', '3/7/2019 7:12 pm') AS date");

      expect(result).toEqual(
        {
          count: 1,
          columns: [{name: 'date', maxCharWidthCount: 0}],
          name: expect.any(String),
          sql: "SELECT date_parse('%uslkajf%n', '3/7/2019 7:12 pm') AS date",
          rows: [[null]]
        }
      );
    });
  });
});
