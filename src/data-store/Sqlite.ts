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
  private db: Database;

  constructor(db: Database) {
    super();
    this.db = db;
  }

  static async create(): Promise<Datastore> {
    const dbPath = path.join(os.tmpdir(), `super.sqlite.${new Date().getTime()}.db`);
    const db = sqlite(dbPath);
    db.pragma("journal_mode = OFF;");
    db.pragma("synchronous = OFF;");
    db.pragma("locking_mode = EXCLUSIVE;");

    return Promise.resolve(new Sqlite(db));
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

  private addBatch(batch: Batch, table: string, columns: Array<string>): void {
    const statement = this.getPreparedInsert(table, columns, batch);

    statement.run(batch.values);
  }

  async addCsv(filePath: string, evaluationMode: boolean): Promise<Result> {
    const stream = fs
      .createReadStream(filePath)
      .pipe(new Parser({
        bom: true,
        trim: true,
        delimiter: ',',
        skipEmptyLines: true
      }));
    const table = this.getTableName(path.parse(filePath).name);

    let firstRow = true;
    const columns: Array<string> = [];
    let count = 0;

    let batch = new Batch();
    const maxBatchValues = 10000;

    const columnNames: Set<string> = new Set();
    const getColumnName = (candidate: string) => {
      if (columnNames.has(candidate))  {
        return getColumnName(`${candidate}_dup`);
      } else {
        return candidate;
      }
    };

    for await (let row of stream)  {
      if (firstRow)  {
        row.forEach((candidate: string) => {
          const newName = getColumnName(candidate);

          columns.push(newName);
          columnNames.add(newName);
        });
        this.db.exec(`CREATE TABLE "${table}" (${columns.map((c) => `"${c}" TEXT`).join(', ')})`);
        this.tables.push(table);

        firstRow = false;
      } else {
        count++;

        if (row.length > columns.length) {
          row.splice(columns.length, row.length - columns.length);
        }

        batch.add(row);

        if (batch.values.length >= maxBatchValues) {
          this.addBatch(batch, table, columns);
          batch.reset();
        }
      }

      if (evaluationMode) {
        if (count >= 100) { break; }
      }
    }

    if (batch.rowCount > 0) {
      this.addBatch(batch, table, columns);
      batch.reset();
    }

    this.cachedPreparedInserts = {}; // Clear the cached prepared statements

    return this.queryAllFromTable(table);
  }

  async exportCsv(table: string, filePath: string): Promise<void> {
    const sink = fs.createWriteStream(filePath, {flags: 'w'});
    const stringifier = new Stringifier({delimiter: ','});
    const writer = stringifier.pipe(sink);

    const statement = this.db.prepare(`SELECT * FROM "${table}"`).raw(true);
    const iterator = statement.iterate();

    const columns = statement.columns().map((c) => c.name);
    stringifier.write(columns);

    return new Promise<void>((resolve, reject) => {
      try {
        const niceWrite = () => {
          let canContinue = true;

          while (canContinue) {
            const {done, value: row} = iterator.next();

            if (done) {
              stringifier.end();
              resolve();
              return;
            }

            canContinue = stringifier.write(row);
          }

          stringifier.once('drain', niceWrite);
        }

        niceWrite();
      } catch (e) {
        reject(e);
      }
    });
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

    const allRows = this.db.prepare(`SELECT * FROM "${table}" LIMIT ${Datastore.MAX_ROW}`).all();

    let columns: Array<string> = [];
    if (allRows.length > 0) {
      Object.keys(allRows[0]).forEach((k) => columns.push(k));
    }

    const rows = Datastore.makePreview(columns, allRows);

    return {
      name: table,
      columns,
      rows,
      count: numOfRows,
    };
  }
}
