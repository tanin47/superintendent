import {Datastore, Result, Row} from './Datastore';
import path from "path";
import {spawn, Thread, Worker} from 'threads';
import {CopySelection} from "../types";

// Every method must be called through the worker because this runs on a different thread.
export class Workerize extends Datastore {
  private worker: any;

  constructor(worker: any) {
    super();
    this.worker = worker;
  }

  static async create(): Promise<Datastore> {
    let prefix = process.env.SUPERINTENDENT_IS_PROD ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'prod') : '.';

    const worker = await spawn(new Worker(path.join(prefix, 'worker')));
    await worker.init({resourcePath: process.resourcesPath, platform: process.platform});
    return Promise.resolve(new Workerize(worker));
  }

  async close(): Promise<void> {
    await this.worker.close();
    return Thread.terminate(this.worker);
  }

  async addSqlite(filePath: string): Promise<Result[]> {
    return this.worker.addSqlite(filePath);
  }

  async addCsv(filePath: string, withHeader: boolean, separator: string, replace: string): Promise<Result[]> {
    return this.worker.addCsv(filePath, withHeader, separator, replace);
  }

  async exportCsv(table: string, filePath: string, delimiter: string): Promise<void> {
    return this.worker.exportCsv(table, filePath, delimiter);
  }

  async query(sql: string, table: string | null): Promise<Result> {
    return this.worker.query(sql, table);
  }

  async copy(table: string, selection: CopySelection): Promise<{text: string, html: string}> {
    return this.worker.copy(table, selection);
  }

  async loadMore(table: string, offset: number): Promise<Row[]> {
    return this.worker.loadMore(table, offset);
  }

  async drop(table: string): Promise<void> {
    return this.worker.drop(table);
  }

  async rename(previousTableName: string, newTableName: string): Promise<void> {
    return this.worker.rename(previousTableName, newTableName);
  }

  async getAllTables(): Promise<string[]> {
    return this.worker.getAllTables();
  }

  async reserveTableName(name: string): Promise<void> {
    return this.worker.reserveTableName(name);
  }
}
