import { expose } from 'threads/worker'
import { Duckdb } from './Duckdb'
import { type Datastore, type Result, type Row } from './Datastore'
import { type DatabaseEngine, type CopySelection, type Sort, type ColumnType } from '../types'
import { Sqlite } from './Sqlite'

export interface Env {
  resourcePath: string
  platform: string
  databaseEngine: DatabaseEngine
}

let sqlite: Datastore | null

expose({
  async init (env: Env): Promise<void> {
    if (sqlite != null) {
      throw new Error('It should have been null.')
    }
    sqlite = env.databaseEngine === 'duckdb' ? new Duckdb(env) : new Sqlite(env)
  },
  async open () {
    await sqlite!.open()
  },
  async close () {
    await sqlite!.close()
  },
  async addSqlite (filePath: string): Promise<Result[]> {
    return await sqlite!.addSqlite(filePath)
  },
  async addCsv (filePath: string, withHeader: boolean, separator: string, replace: string): Promise<Result[]> {
    return await sqlite!.addCsv(filePath, withHeader, separator, replace)
  },
  async exportCsv (table: string, filePath: string, delimiter: string): Promise<void> {
    await sqlite!.exportCsv(table, filePath, delimiter)
  },
  async query (sql: string, table: string | null): Promise<Result> {
    return await sqlite!.query(sql, table)
  },
  async sort (table: string, sorts: Sort[]): Promise<Result> {
    return await sqlite!.sort(table, sorts)
  },
  async copy (table: string, selection: CopySelection): Promise<{ text: string, html: string }> {
    return await sqlite!.copy(table, selection)
  },
  async loadMore (table: string, offset: number): Promise<Row[]> {
    return await sqlite!.loadMore(table, offset)
  },
  async drop (table: string): Promise<void> {
    await sqlite!.drop(table)
  },
  async rename (previousTableName: string, newTableName: string): Promise<void> {
    await sqlite!.rename(previousTableName, newTableName)
  },
  async changeColumnType (tableName: string, columnName: string, newColumnType: ColumnType, timestampFormat: string | null): Promise<Result> {
    return await sqlite!.changeColumnType(tableName, columnName, newColumnType, timestampFormat)
  },
  async getAllTables (): Promise<string[]> {
    return await sqlite!.getAllTables()
  },
  async reserveTableName (name: string): Promise<void> {
    await sqlite!.reserveTableName(name)
  }
})
