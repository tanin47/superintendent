import { expose } from 'threads/worker';
import {Env, Sqlite} from "./Sqlite";
import {Result} from "./Datastore";

let sqlite: Sqlite | null;

expose({
  init(env: Env): void {
    if (sqlite != null) {
      sqlite.close();
      sqlite = null;
    }
    sqlite = new Sqlite(env);
  },
  async addSqlite(filePath: string, evaluationMode: boolean): Promise<Result[]> {
    return sqlite!.addSqlite(filePath, evaluationMode);
  },
  async addCsv(filePath: string, separator: string, evaluationMode: boolean): Promise<Result[]> {
    return sqlite!.addCsv(filePath, separator, evaluationMode);
  },
  async exportCsv(table: string, filePath: string): Promise<void> {
    return sqlite!.exportCsv(table, filePath);
  },
  async exportSchema(filePath: string): Promise<void> {
    return sqlite!.exportSchema(filePath);
  },
  async query(sql: string): Promise<Result> {
    return sqlite!.query(sql);
  },
  async drop(table: string): Promise<void> {
    return sqlite!.drop(table);
  }
})
