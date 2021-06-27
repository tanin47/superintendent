import {Datastore, Result} from './Datastore';
import * as sqlite from "sqlite";
import {Database} from "sqlite";
import path from "path";
import os from "os";
import sqlite3 from "sqlite3";
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
    const db = await sqlite.open({
      filename: path.join(os.tmpdir(), `super.sqlite.${new Date().getTime()}.db`),
      driver: sqlite3.Database
    })
    await db.exec('PRAGMA writable_schema = 1; \
      DELETE FROM sqlite_master; \
      PRAGMA writable_schema = 0; \
      VACUUM; \
      PRAGMA integrity_check;');
    await db.exec("PRAGMA journal_mode = OFF;");
    await db.exec("PRAGMA synchronous = OFF;");
    await db.exec("PRAGMA locking_mode = EXCLUSIVE;");

    return new Sqlite(db);
  }

  private async addBatch(batch: Batch, table: string, columns: Array<string>): Promise<void> {
    const colLine = columns.map((c) => '?').join(', ');
    const values: string[] = [];

    for (let i=0;i<batch.rowCount;i++) {
      values.push(`(${colLine})`);
    }

    await this.db.run(`INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(',')}) VALUES ${values.join(',')};`, batch.values);
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
        await this.db.exec(`CREATE TABLE "${table}" (${columns.map((c) => `"${c}" TEXT`).join(', ')})`);
        this.tables.push(table);

        firstRow = false;
      } else {
        count++;

        if (row.length > columns.length) {
          row.splice(columns.length, row.length - columns.length);
        }

        batch.add(row);

        if (batch.values.length >= maxBatchValues) {
          await this.addBatch(batch, table, columns);
          batch.reset();
        }
      }

      if (evaluationMode) {
        if (count >= 100) { break; }
      }
    }

    if (batch.rowCount > 0) {
      await this.addBatch(batch, table, columns);
      batch.reset();
    }

    return this.queryAllFromTable(table);
  }

  async exportCsv(table: string, filePath: string): Promise<void> {
    // We should paginate it.
    const rows = await this.db.all(`SELECT * FROM "${table}"`);

    let columns: Array<string> = [];
    if (rows.length > 0) {
      Object.keys(rows[0]).forEach((k) => columns.push(k))
    }

    const sink = fs.createWriteStream(filePath, {flags: 'w'});
    const stringifier = new Stringifier({delimiter: ','});
    const writer = stringifier.pipe(sink);

    stringifier.write(columns);

    return new Promise<void>((resolve, reject) => {
      try {
        let numRowLeft = rows.length;

        const niceWrite = () => {
          let canContinue = true;

          while (canContinue && numRowLeft > 0) {
            const nextRow = rows[rows.length - numRowLeft];
            if (numRowLeft === 1) {
              stringifier.write(columns.map((c) => nextRow[c]), () => {
                stringifier.end();
                resolve();
              });
            } else {
              canContinue = stringifier.write(columns.map((c) => nextRow[c]));
            }
            numRowLeft--;
          }

          if (numRowLeft > 0) {
            stringifier.once('drain', niceWrite);
          }
        }

        niceWrite();
      } catch (e) {
        reject(e);
      }
    });
  }

  async query(sql: string): Promise<Result> {
    const table = this.makeQueryTableName();
    await this.db.run(`CREATE VIEW "${table}" AS ${sql}`);
    this.tables.push(table);

    return this.queryAllFromTable(table);
  }

  private async queryAllFromTable(table: string): Promise<Result> {
    const numOfRowsResult = await this.db.all(`SELECT COUNT(*) AS number_of_rows FROM "${table}"`);
    const numOfRows = numOfRowsResult.length == 0 ? 0 : numOfRowsResult[0].number_of_rows;

    const allRows = await this.db.all(`SELECT * FROM "${table}" LIMIT ${Datastore.MAX_ROW}`);

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
