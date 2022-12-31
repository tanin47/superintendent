import { expose } from 'threads/worker';
import {Env, Sqlite} from "./Sqlite";
import {Result, Row} from "./Datastore";
import {CopySelection} from "../types";

let sqlite: Sqlite | null;

expose({
  init(env: Env): void {
    if (sqlite != null) {
      throw new Error('It should have been null.');
    }
    sqlite = new Sqlite(env);
  },
  async close() {
    sqlite!.close();
  },
  async addSqlite(filePath: string): Promise<Result[]> {
    return sqlite!.addSqlite(filePath);
  },
  async addCsv(filePath: string, withHeader: boolean, separator: string, replace: string): Promise<Result[]> {
    return sqlite!.addCsv(filePath, withHeader, separator, replace);
  },
  async exportCsv(table: string, filePath: string, delimiter: string): Promise<void> {
    return sqlite!.exportCsv(table, filePath, delimiter);
  },
  async exportSchema(filePath: string): Promise<void> {
    return sqlite!.exportSchema(filePath);
  },
  async query(sql: string, table: string | null): Promise<Result> {
    return sqlite!.query(sql, table);
  },
  async copy(table: string, selection: CopySelection): Promise<{text: string, html: string}> {
    return sqlite!.copy(table, selection);
  },
  async loadMore(table: string, offset: number): Promise<Row[]> {
    return sqlite!.loadMore(table, offset);
  },
  async drop(table: string): Promise<void> {
    return sqlite!.drop(table);
  },
  async rename(previousTableName: string, newTableName: string): Promise<void> {
    return sqlite!.rename(previousTableName, newTableName);
  }
})
