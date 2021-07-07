import { expose } from 'threads/worker';
import {Env, Sqlite} from "./Sqlite";
import {Result} from "./Datastore";

let sqlite: Sqlite | null;

expose({
  init(dbPath: string, env: Env): void {
    if (sqlite != null) {
      sqlite.close();
      sqlite = null;
    }
    sqlite = new Sqlite(dbPath, env);
  },
  async addCsv(filePath: string, evaluationMode: boolean): Promise<Result> {
    return sqlite!.addCsv(filePath, evaluationMode);
  },
  async exportCsv(table: string, filePath: string): Promise<void> {
    return sqlite!.exportCsv(table, filePath);
  },
  async query(sql: string): Promise<Result> {
    return sqlite!.query(sql);
  }
})
