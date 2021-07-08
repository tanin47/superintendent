import {Datastore, Result} from './Datastore';
import path from "path";
import os from "os";
import {spawn, Thread, Worker} from 'threads';

export class Workerize extends Datastore {
  private worker: any;

  constructor(worker: any) {
    super();
    this.worker = worker;
  }

  static async create(dbPath: string | null = null): Promise<Datastore> {
    dbPath ||= path.join(os.tmpdir(), `super.sqlite.${new Date().getTime()}.db`);

    let prefix = process.env.SUPERINTENDENT_IS_PROD ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'prod') : '.';


    const worker = await spawn(new Worker(path.join(prefix, 'worker')));
    await worker.init(dbPath, {resourcePath: process.resourcesPath, platform: process.platform});
    return Promise.resolve(new Workerize(worker));
  }

  close(): Promise<void> {
    return Thread.terminate(this.worker);
  }

  async addCsv(filePath: string, evaluationMode: boolean): Promise<Result> {
    return this.worker.addCsv(filePath, evaluationMode);
  }

  async exportCsv(table: string, filePath: string): Promise<void> {
    return this.worker.exportCsv(table, filePath);
  }

  async query(sql: string): Promise<Result> {
    return this.worker.query(sql);
  }
}
