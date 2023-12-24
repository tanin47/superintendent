import { expose } from 'threads/worker'
import { type Env, Sqlite } from './Sqlite'
import { type Result, type Row } from './Datastore'
import { type CopySelection, type Sort } from '../types'

let sqlite: Sqlite | null

expose({
  init (env: Env): void {
    if (sqlite != null) {
      throw new Error('It should have been null.')
    }
    sqlite = new Sqlite(env)
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
  async getAllTables (): Promise<string[]> {
    return await sqlite!.getAllTables()
  },
  async reserveTableName (name: string): Promise<void> {
    await sqlite!.reserveTableName(name)
  }
})
