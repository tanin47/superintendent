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
      await workerize.addCsv(evaluationTestCsvFilePath, true);

      const result = await workerize.query("SELECT * FROM evaluation_test");

      expect(result.count).toEqual(100);
      expect(result.rows.length).toEqual(100);
    })

    it('loads all rows', async () => {
      await workerize.addCsv(evaluationTestCsvFilePath, false);

      const result = await workerize.query("SELECT * FROM evaluation_test");

      expect(result.count).toEqual(150);
      expect(result.rows.length).toEqual(150);
    })
  });

  describe('test preview', () => {
    // TODO: write a few test.
  });

  describe('import/export', () => {
    it('import bom', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/bom.csv', false);
      const result = await workerize.query("SELECT * FROM bom");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['bom_column_1', 'bom_column_2'],
          name: 'query_1',
          sql: "SELECT * FROM bom",
          rows: [['value1', 'value2']]
        }
      );

      await workerize.exportCsv('bom', exportedPath);
      expect(fs.readFileSync(exportedPath, {encoding: 'utf8'})).toEqual(
        'bom_column_1,bom_column_2\r\nvalue1,value2\r\n'
      );
    });

    it('import unicode', async () => {
      await workerize.addCsv('./test/data-store/csv-samples/unicode.csv', false);
      const result = await workerize.query("SELECT * FROM unicode");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['something', 'another'],
          name: 'query_1',
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
      await workerize.addCsv('./test/data-store/csv-samples/quote.csv', false);
      const result = await workerize.query("SELECT * FROM quote");

      expect(result).toEqual(
        {
          count: 2,
          columns: ['first_name', 'last_name', 'email'],
          name: 'query_1',
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

  describe('regex_extract', () => {
    it('extract date', async () => {
      const result = await workerize.query("SELECT regex_extract('[0-9]+/([0-9]+)/[0-9]+', '3/7/2019') AS month");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['month'],
          name: 'query_1',
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
          columns: ['month'],
          name: 'query_1',
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
          columns: ['month'],
          name: 'query_1',
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
          columns: ['month'],
          name: 'query_1',
          sql: "SELECT regex_extract('([0-9+)/([0-9]+/([0-9]+', 'abcd') AS month",
          rows: [[null]]
        }
      );
    });
  });

  describe('date_parse', () => {
    it('parse date', async () => {
      const result = await workerize.query("SELECT date_parse('%m/%d/%Y', '3/7/2019') AS date");

      expect(result).toEqual(
        {
          count: 1,
          columns: ['date'],
          name: 'query_1',
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
          columns: ['date'],
          name: 'query_1',
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
          columns: ['date'],
          name: 'query_1',
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
          columns: ['date'],
          name: 'query_1',
          sql: "SELECT date_parse('%uslkajf%n', '3/7/2019 7:12 pm') AS date",
          rows: [[null]]
        }
      );
    });
  });
});
