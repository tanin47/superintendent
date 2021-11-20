import {Column, Datastore, Result, Row} from './Datastore';
import sqlite, {Database, Statement} from 'better-sqlite3';
import path from "path";
import fs from "fs";
import {Parser} from "csv-parse";

export type Env = {
  resourcePath: string,
  platform: string
}

export class Sqlite extends Datastore {
  private env!: Env;
  private db!: Database;

  constructor(env: Env) {
    super();
    this.env = env;
    this.open();
  }

  private open() {
    this.db = sqlite(':memory:');
    this.db.pragma("journal_mode = OFF;");
    this.db.pragma("synchronous = OFF;");
    this.db.pragma("locking_mode = EXCLUSIVE;");

    let prefix = process.env.SUPERINTENDENT_IS_PROD ? this.env.resourcePath : '.';
    let ext = 'dylib';

    switch (this.env.platform) {
      case 'darwin':
        ext = 'dylib';
        break;
      case 'linux':
        ext = 'so';
        break;
      case 'win32':
        ext = 'dll';
        break;
      default:
        throw new Error(`The platform ${this.env.platform} is not supported.`)
    }

    this.db.loadExtension(path.join(prefix, 'deps', 'ext', `ext.${ext}`));
    this.db.loadExtension(path.join(prefix, 'deps', 'csv', `csv.${ext}`));
    this.db.loadExtension(path.join(prefix, 'deps', 'csv_writer', `csv_writer.${ext}`));
  }

  close() {
    this.db.close();
  }

  async addSqlite(filePath: string, evaluationMode: boolean): Promise<Result[]> {
    this.db.exec(`ATTACH DATABASE '${filePath}' AS temp_database;`);

    const rows = this.db.prepare(`SELECT tbl_name FROM temp_database.sqlite_master WHERE type = 'table';`).raw(true).all();

    const results: Result[] = [];

    for (const row of rows) {
      const old_name = row[0];
      const table = this.getTableName(old_name);
      this.db.exec(`CREATE TABLE "${table}" AS SELECT * FROM "temp_database"."${old_name}" ${evaluationMode ? 'LIMIT 100' : ''}`);
      results.push(await this.queryAllFromTable(table, `SELECT * FROM "${table}"`));
    }

    this.db.exec(`DETACH DATABASE temp_database;`);

    return results;
  }

  async addCsv(filePath: string, separator: string, evaluationMode: boolean): Promise<Result[]> {
    const table = this.getTableName(path.parse(filePath).name);

    const stream = fs
      .createReadStream(filePath)
      .pipe(new Parser({
        bom: true,
        trim: true,
        delimiter: separator,
        skipEmptyLines: true,
        relax: true,
      }));

    const columns: Array<string> = [];

    const sanitizedColumnNames: Set<string> = new Set();
    const getColumnName = (candidate: string) => {
      if (sanitizedColumnNames.has(candidate.toLowerCase()))  {
        return getColumnName(`${candidate}_dup`);
      } else {
        return candidate;
      }
    };

    let createTable: string;
    for await (let row of stream) {
      row.forEach((candidate: string) => {
        const newName = getColumnName(this.sanitizeName(candidate));

        columns.push(newName);
        sanitizedColumnNames.add(newName.toLowerCase());
      });
      createTable = `CREATE TABLE x(${columns.map((c) => `"${c}" TEXT`).join(', ')})`;
      break;
    }

    const virtualTable = this.getTableName("virtual_" + table);
    this.db.exec(`CREATE VIRTUAL TABLE "${virtualTable}" USING csv(filename='${filePath}', header=true, schema='${createTable!}', separator='${separator}')`);
    this.db.exec(`CREATE TABLE "${table}" AS SELECT * FROM "${virtualTable}" ${evaluationMode ? 'LIMIT 100' : ''}`);
    this.db.exec(`DROP TABLE "${virtualTable}"`);

    const result = await this.queryAllFromTable(table, `SELECT * FROM "${table}"`);
    return [result];
  }

  async exportCsv(table: string, filePath: string): Promise<void> {
    let columns: string[];
    {
      const statement = this.db.prepare(`SELECT * FROM "${table}" LIMIT 1`).raw(true);

      columns = statement.columns().map((c) => c.name);

      const iterator = statement.iterate();
      while (true) {
        const {done} = iterator.next(); // drain it
        if (done) {
          break;
        }
      }
    }

    this.db.exec(`CREATE VIRTUAL TABLE "temp_table_name" USING csv_writer(filename='${filePath}', columns='${columns!.join(',')}')`);
    this.db.exec(`INSERT INTO "temp_table_name" SELECT * FROM "${table}"`);
    this.db.exec(`DROP TABLE "temp_table_name"`);

    return Promise.resolve();
  }

  async exportSchema(filePath: string): Promise<void> {
    const rows = this.db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table';`).raw(true).all();

    const writer = fs.createWriteStream(filePath, {flags: 'w'});

    for (const row of rows) {
      writer.write(row[0]);
      writer.write('\n\n');
    }
    writer.close();
  }

  async drop(table: string): Promise<void> {
    try {
      this.db.exec(`DROP TABLE IF EXISTS "${table}"`);

      for (let i=0;i<this.tables.length;i++) {
        if (table === this.tables[i]) {
          this.tables.splice(i, 1);
          break;
        }
      }
    } catch (e) { }
  }

  async rename(previousTableName: string, newTableName: string): Promise<void> {
    try {
      this.db.exec(`ALTER TABLE "${previousTableName}" RENAME TO "${newTableName}"`);
    } catch (e) {
      return Promise.reject(e);
    }

    for (let i=0;i<this.tables.length;i++) {
      if (previousTableName === this.tables[i]) {
        this.tables.splice(i, 1, newTableName);
        break;
      }
    }
  }

  async query(sql: string): Promise<Result> {
    const table = this.makeQueryTableName();
    this.db.exec(`CREATE TABLE "${table}" AS ${sql}`);

    return Promise.resolve(this.queryAllFromTable(table, sql));
  }

  async loadMore(table: string, offset: number): Promise<Row[]> {
    const statement = this.db.prepare(`SELECT * FROM "${table}" LIMIT ${Datastore.MAX_ROW_LOAD_MORE} OFFSET ${offset}`).raw(true)
    const allRows = statement.all();

    return Promise.resolve(allRows);
  }

  private queryAllFromTable(table: string, sql: string): Result {
    const numOfRowsResult = this.db.prepare(`SELECT COUNT(*) AS number_of_rows FROM "${table}"`).all();
    const numOfRows = numOfRowsResult.length == 0 ? 0 : numOfRowsResult[0].number_of_rows;

    const statement = this.db.prepare(`SELECT * FROM "${table}" LIMIT ${Datastore.MAX_ROW}`).raw(true)
    const allRows = statement.all();

    let previewedNumOfRows = Math.min(numOfRows, Datastore.MAX_ROW);

    if (previewedNumOfRows < 100) {
      previewedNumOfRows = 100;
    }

    const columnNames = statement.columns().map((c) => c.name);
    const sampleSql = `SELECT * FROM (SELECT rowid, * FROM "${table}" LIMIT ${Datastore.MAX_ROW}) WHERE ((rowid - 1) % ${Math.ceil(previewedNumOfRows / 100)}) = 0 OR rowid = ${previewedNumOfRows}`;
    const metdataSql = `SELECT ${columnNames.map((col) => { return `MAX(COALESCE(NULLIF(INSTR(CAST("${col}" AS text), x'0a'), 0), LENGTH(CAST("${col}" AS text)))) AS "${col}"` }).join(',')} FROM (${sampleSql})`

    const metadataResult = this.db.prepare(metdataSql).all();

    let columns: Column[] = columnNames.map((col) => {
      return {
        name: col,
        maxCharWidthCount: 0
      };
    });

    if (metadataResult.length > 0) {
      columns = [];
      for (const key in metadataResult[0]) {
        if (metadataResult[0].hasOwnProperty(key)) {
          columns.push({
            name: key,
            maxCharWidthCount: metadataResult[0][key] || 0
          });
        }
      }
    }

    return {
      name: table,
      sql,
      columns,
      rows: allRows,
      count: numOfRows,
    };
  }
}
