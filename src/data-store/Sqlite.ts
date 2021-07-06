import {Datastore, Result} from './Datastore';
import sqlite, {Database, Statement} from 'better-sqlite3';
import path from "path";
import os from "os";
import fs from "fs";
import {Parser} from "csv-parse";
import {Stringifier} from "csv-stringify";


class Batch {
  rowCount: number = 0;
  values: Array<string> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.rowCount = 0;
    this.values = [];
  }

  add(row: string[]) {
    for (const value of row) {
      this.values.push(value);
    }
    this.rowCount++;
  }
}

export class Sqlite extends Datastore {
  dbPath: string;
  private db!: Database;

  constructor(dbPath: string) {
    super();
    this.dbPath = dbPath;
    this.open();
  }

  private open() {
    this.db = sqlite(this.dbPath);
    this.db.pragma("journal_mode = OFF;");
    this.db.pragma("synchronous = OFF;");
    this.db.pragma("locking_mode = EXCLUSIVE;");
    // @ts-ignore
    this.db.unsafeMode(true);

    let prefix = process.env.SUPERINTENDENT_IS_PROD ? process.resourcesPath : '.';
    let ext = 'dylib';

    switch (process.platform) {
      case 'darwin':
        ext = 'dylib';
        break;
      case 'win32':
        ext = 'dll';
        break;
      default:
        throw new Error(`The platform ${process.platform} is not supported.`)
    }

    this.db.loadExtension(path.join(prefix, 'deps', 'ext', `ext.${ext}`));
    this.db.loadExtension(path.join(prefix, 'deps', 'csv', `csv.${ext}`));
    this.db.loadExtension(path.join(prefix, 'deps', 'csv_writer', `csv_writer.${ext}`));
  }

  close() {
    this.db.close();
  }

  static async create(): Promise<Datastore> {
    const dbPath = path.join(os.tmpdir(), `super.sqlite.${new Date().getTime()}.db`);

    return Promise.resolve(new Sqlite(dbPath));
  }

  private cachedPreparedInserts: {[rowCount: number]: Statement} = {};

  private getPreparedInsert(table: string, columns: string[], batch: Batch): Statement {
    if (this.cachedPreparedInserts[batch.rowCount]) {
      return this.cachedPreparedInserts[batch.rowCount];
    }

    const colLine = columns.map((c) => '?').join(', ');
    const values: string[] = [];

    for (let i=0;i<batch.rowCount;i++) {
      values.push(`(${colLine})`);
    }

    const statement = this.db.prepare(`INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(',')}) VALUES ${values.join(',')};`);
    this.cachedPreparedInserts[batch.rowCount] = statement;

    return statement;
  }

  async addCsv(filePath: string, evaluationMode: boolean): Promise<Result> {
    const table = this.getTableName(path.parse(filePath).name);
    this.tables.push(table);

    const stream = fs
      .createReadStream(filePath)
      .pipe(new Parser({
        bom: true,
        trim: true,
        delimiter: ',',
        skipEmptyLines: true
      }));

    const columns: Array<string> = [];

    const columnNames: Set<string> = new Set();
    const getColumnName = (candidate: string) => {
      if (columnNames.has(candidate))  {
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
        columnNames.add(newName);
      });
      createTable = `CREATE TABLE x(${columns.map((c) => `"${c}" TEXT`).join(', ')})`;
      break;
    }

    const virtualTable = this.getTableName("virtual_" + table);
    this.db.exec(`CREATE VIRTUAL TABLE "${virtualTable}" USING csv(filename='${filePath}', header=true, schema='${createTable!}')`);

    this.db.exec(`CREATE TABLE "${table}" AS SELECT * FROM "${virtualTable}" ${evaluationMode ? 'LIMIT 100' : ''}`);

    return this.queryAllFromTable(table);
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

  async query(sql: string): Promise<Result> {
    const table = this.makeQueryTableName();
    this.db.exec(`CREATE VIEW "${table}" AS ${sql}`);
    this.tables.push(table);

    return Promise.resolve(this.queryAllFromTable(table));
  }

  private queryAllFromTable(table: string): Result {
    const numOfRowsResult = this.db.prepare(`SELECT COUNT(*) AS number_of_rows FROM "${table}"`).all();
    const numOfRows = numOfRowsResult.length == 0 ? 0 : numOfRowsResult[0].number_of_rows;

    const statement = this.db.prepare(`SELECT * FROM "${table}" LIMIT ${Datastore.MAX_ROW}`).raw(true)
    const allRows = statement.all();

    let columns = statement.columns().map((c) => c.name);
    const rows = Datastore.makePreview(columns, allRows);

    return {
      name: table,
      columns,
      rows,
      count: numOfRows,
    };
  }
}
