import fs from 'fs';
import {Sqlite} from "../../src/data-store/Sqlite";
import path from "path";
import os from "os";

describe('Sqlite', () => {
  let sqlite: Sqlite;
  let exportedPath: string;

  beforeEach(() => {
    const dbPath = path.join(os.tmpdir(), `test.sqlite.${new Date().getTime()}-${Math.random()}.db`);
    exportedPath = path.join(os.tmpdir(), `exported.${new Date().getTime()}-${Math.random()}.csv`);
    sqlite = new Sqlite(dbPath);
  });

  afterEach(() =>{
    sqlite.close();
    if (fs.existsSync(exportedPath)) {
      fs.unlinkSync(exportedPath);
    }
    fs.unlinkSync(sqlite.dbPath);
  });

  describe('handle the evaluation mode', () => {
    let evaluationTestCsvFilePath = path.join(os.tmpdir(), `evaluation_test.csv`);
    beforeAll(() => {
      let content = 'one_col\r\n';
      for (let i=0;i<150;i++) {
        content += `row_${i}\r\n`;
      }
      fs.writeFileSync(evaluationTestCsvFilePath, content, {flag: 'w'});
    });

    afterAll(() =>{
      fs.unlinkSync(evaluationTestCsvFilePath);
    });

    it('only loads 100 rows because of the evaluation mode', async () => {
      await sqlite.addCsv(evaluationTestCsvFilePath, true);

      const result = await sqlite.query("SELECT * FROM evaluation_test");

      expect(result.count).toEqual(100);
      expect(result.rows.length).toEqual(100);
    })

    it('loads all rows', async () => {
      await sqlite.addCsv(evaluationTestCsvFilePath, false);

      const result = await sqlite.query("SELECT * FROM evaluation_test");

      expect(result.count).toEqual(150);
      expect(result.rows.length).toEqual(150);
    })
  });

  describe('test preview', () => {
    // TODO: write a few test.
  });

  describe('import/export', () => {
    it('import bom', async () => {
      await sqlite.addCsv('./test/data-store/csv-samples/bom.csv', false);
      const result = await sqlite.query("SELECT * FROM bom");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['bom_column_1', 'bom_column_2'],
          name: 'query_1',
          rows: [['value1', 'value2']]
        }
      );

      await sqlite.exportCsv('bom', exportedPath);
      expect(fs.readFileSync(exportedPath, {encoding: 'utf8'})).toEqual(
        'bom_column_1,bom_column_2\r\nvalue1,value2\r\n'
      );
    });

    it('import unicode', async () => {
      await sqlite.addCsv('./test/data-store/csv-samples/unicode.csv', false);
      const result = await sqlite.query("SELECT * FROM unicode");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['something', 'another'],
          name: 'query_1',
          rows: [['ก ไก่', 'ข ไข่']]
        }
      );
      await sqlite.exportCsv('unicode', exportedPath);
      expect(fs.readFileSync(exportedPath, {encoding: 'utf8'})).toEqual(
        'something,another\r\n"ก ไก่","ข ไข่"\r\n'
      );
    });

    it('import quote', async () => {
      await sqlite.addCsv('./test/data-store/csv-samples/quote.csv', false);
      const result = await sqlite.query("SELECT * FROM quote");

      expect(result).toEqual(
        {
          count: 2,
          columns: ['first_name', 'last_name', 'email'],
          name: 'query_1',
          rows: [
            ['john', 'doe, do', ' "test@doe.com"'],
            ['nanakorn, " tanin', ' somename ', 'some email'],
          ]
        }
      );

      await sqlite.exportCsv('quote', exportedPath);
      expect(fs.readFileSync(exportedPath, {encoding: 'utf8'})).toEqual(
        'first_name,last_name,email\r\njohn,"doe, do"," ""test@doe.com"""\r\n"nanakorn, "" tanin"," somename ","some email"\r\n'
      );
    });
  });

  describe('regex_extract', () => {
    it('extract date', async () => {
      const result = await sqlite.query("SELECT regex_extract('[0-9]+/([0-9]+)/[0-9]+', '3/7/2019') AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['month'],
          name: 'query_1',
          rows: [['7']]
        }
      );
    });

    it('multiple extracts', async () => {
      const result = await sqlite.query("SELECT regex_extract('([0-9]+)/([0-9]+)/([0-9]+)', '3/7/2019') AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['month'],
          name: 'query_1',
          rows: [['3']]
        }
      );
    });

    it('does not match', async () => {
      const result = await sqlite.query("SELECT regex_extract('([0-9]+)/([0-9]+)/([0-9]+)', 'abcd') AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['month'],
          name: 'query_1',
          rows: [[null]]
        }
      );
    });

    it('invalid regex', async () => {
      const result = await sqlite.query("SELECT regex_extract('([0-9+)/([0-9]+/([0-9]+', 'abcd') AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['month'],
          name: 'query_1',
          rows: [[null]]
        }
      );
    });
  });

  describe('date_parse', () => {
    it('parse date', async () => {
      const result = await sqlite.query("SELECT date_parse('%m/%d/%Y', '3/7/2019') AS date");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['date'],
          name: 'query_1',
          rows: [['2019-03-07']]
        }
      );
    });

    it('parse date time', async () => {
      const result = await sqlite.query("SELECT date_parse('%m/%d/%Y %I:%M %p', '3/7/2019 7:12 pm') AS date");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['date'],
          name: 'query_1',
          rows: [['2019-03-07T19:12:00.000Z']]
        }
      );
    });

    it('invalid value', async () => {
      const result = await sqlite.query("SELECT date_parse('%m/%d/%Y %I:%M %p', 'abcd') AS date");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['date'],
          name: 'query_1',
          rows: [[null]]
        }
      );
    });

    it('invalid format', async () => {
      const result = await sqlite.query("SELECT date_parse('%uslkajf%n', '3/7/2019 7:12 pm') AS date");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['date'],
          name: 'query_1',
          rows: [[null]]
        }
      );
    });
  });
});
