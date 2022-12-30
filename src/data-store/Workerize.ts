import {Datastore, Result, Row} from './Datastore';
import path from "path";
import {spawn, Thread, Worker} from 'threads';
import {CopySelection} from "../types";

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

  close(): Promise<void> {
    return Thread.terminate(this.worker);
  }

  async addSqlite(filePath: string, evaluationMode: boolean): Promise<Result[]> {
    return this.worker.addSqlite(filePath, evaluationMode);
  }

  async addCsv(filePath: string, withHeader: boolean, separator: string, replace: string, evaluationMode: boolean): Promise<Result[]> {
    return this.worker.addCsv(filePath, withHeader, separator, replace, evaluationMode);
  }

  async exportCsv(table: string, filePath: string): Promise<void> {
    return this.worker.exportCsv(table, filePath);
  }

  async exportSchema(filePath: string): Promise<void> {
    return this.worker.exportSchema(filePath);
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
}
