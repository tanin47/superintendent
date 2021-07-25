import {Datastore, Result} from './Datastore';
import path from "path";
import {spawn, Thread, Worker} from 'threads';

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

  async addCsv(filePath: string, separator: string, evaluationMode: boolean): Promise<Result[]> {
    return this.worker.addCsv(filePath, separator, evaluationMode);
  }

  async exportCsv(table: string, filePath: string): Promise<void> {
    return this.worker.exportCsv(table, filePath);
  }

  async exportSchema(filePath: string): Promise<void> {
    return this.worker.exportSchema(filePath);
  }

  async query(sql: string): Promise<Result> {
    return this.worker.query(sql);
  }

  async drop(table: string): Promise<void> {
    return this.worker.drop(table);
  }
}
