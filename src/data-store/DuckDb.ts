import {Column, Datastore, Result, Row} from "./Datastore";
import duckdb from 'duckdb';
import path from "path";
import os from "os";
import fs from "fs";
import {Parser} from "csv-parse";

export class DuckDb extends Datastore {
  private db: duckdb.Database;
  private databaseFile: string;

  constructor(databaseFile: string) {
    super();
    this.databaseFile = databaseFile;
    this.connect();
  }

  private connect(): void {
    this.db = new duckdb.Database(this.databaseFile)
  }

  static async create(): Promise<Datastore> {
    return new DuckDb(path.join(os.tmpdir(), `super.duck.${new Date().getTime()}.db`));
  }

  async getColumns(csvPath: string): Promise<Column[]> {
    const stream = fs
      .createReadStream(csvPath)
      .pipe(new Parser({
        bom: true,
        trim: true,
        delimiter: ',',
        skipEmptyLines: true
      }));

    const columns: Column[] = [];
    const columnNames: Set<string> = new Set();
    const getColumnName = (candidate: string) => {
      if (columnNames.has(candidate))  {
        return getColumnName(`${candidate}_dup`);
      } else {
        return candidate;
      }
    };

    for await (const row of stream) {
      row.forEach((candidate: string) => {
        const newName = getColumnName(candidate.replace(/["]/g, '').trim());

        columns.push(newName);
        columnNames.add(newName);
      });
      break;
    }

    return columns;
  }

  async addCsv(filePath: string, evaluationMode: boolean): Promise<Result> {
    const table = this.getTableName(path.parse(filePath).name);

    const columns = await this.getColumns(filePath);

    await this.run(`CREATE TABLE "${table}" (${columns.map((c) => `"${c}" TEXT`).join(', ')})`);
    await this.run(`INSERT INTO "${table}" SELECT * FROM read_csv_auto('${filePath}', HEADER=TRUE, ALL_VARCHAR=TRUE) ${evaluationMode ? 'LIMIT 100' : ''};`);
    await this.run(`UPDATE "${table}" SET ${columns.map((c) => `"${c}" = trim("${c}", ' \t\n\r"''')`).join(', ')}`);
    this.tables.push(table);

    return this.queryFromTable(table);
  }
  async exportCsv(table: string, filePath: string): Promise<void> {
    await this.run(`COPY "${table}" TO '${filePath}' WITH (HEADER 1, DELIMITER ',')`);
    await this.close();
    this.connect();
  }

  async query(sql: string): Promise<Result> {
    const table = this.makeQueryTableName();
    await this.run(`CREATE VIEW "${table}" AS ${sql}`);
    this.tables.push(table);

    return this.queryFromTable(table);
  }

  private async run(sql: string): Promise<Row[]> {
    return new Promise<Row[]>((resolve, reject) => {
      this.db.run(sql, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  private async close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.close(resolve);
    });
  }

  private async queryAll(sql: string): Promise<Row[]> {
    return new Promise<Row[]>((resolve, reject) => {

      process.on('uncaughtException', (error: Error) => {
        if (error.message === 'Data type is not supported DATE' || error.message === 'Data type is not supported TIMESTAMP') {
          reject({
            name: 'Error',
            message: 'Date and timestamp cannot be shown in the table. Please use strftime(..) to format a date or timestamp to a string.\n\nVisit https://docs.superintendent.app/faq/faq-handle-date-time for more information.'
          })
        } else {
          reject(error);
        }
      });

      this.db.all(sql, (err, result) => {
        process.removeAllListeners('uncaughtException');

        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  private async queryFromTable(table: string): Promise<Result> {
    const numOfRowsResult = await this.queryAll(`SELECT COUNT(*) AS number_of_rows FROM "${table}"`);
    const numOfRows = numOfRowsResult.length == 0 ? 0 : numOfRowsResult[0].number_of_rows;

    const allRows = await this.queryAll(`SELECT * FROM "${table}" LIMIT ${Datastore.MAX_ROW}`);

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
