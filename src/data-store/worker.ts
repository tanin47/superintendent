import { expose } from 'threads/worker'
import { Duckdb } from './Duckdb'
import { type Datastore, type Result, type Row } from './Datastore'
import { type CopySelection, type Sort, type ColumnType } from '../types'

export interface Env {
  resourcePath: string
  platform: string
}

let datastore: Datastore | null

expose({
  async init (env: Env): Promise<void> {
    if (datastore != null) {
      throw new Error('It should have been null.')
    }
    datastore = new Duckdb(env)
  },
  async open () {
    await datastore!.open()
  },
  async close () {
    await datastore!.close()
  },
  async addCsv (filePath: string, withHeader: boolean, separator: string, replace: string): Promise<Result[]> {
    return await datastore!.addCsv(filePath, withHeader, separator, replace)
  },
  async exportCsv (table: string, filePath: string, delimiter: string): Promise<void> {
    await datastore!.exportCsv(table, filePath, delimiter)
  },
  async query (sql: string, table: string | null): Promise<Result> {
    return await datastore!.query(sql, table)
  },
  async sort (table: string, sorts: Sort[]): Promise<Result> {
    return await datastore!.sort(table, sorts)
  },
  async copy (table: string, selection: CopySelection): Promise<{ text: string, html: string }> {
    return await datastore!.copy(table, selection)
  },
  async loadMore (table: string, offset: number): Promise<Row[]> {
    return await datastore!.loadMore(table, offset)
  },
  async drop (table: string): Promise<void> {
    await datastore!.drop(table)
  },
  async rename (previousTableName: string, newTableName: string): Promise<void> {
    await datastore!.rename(previousTableName, newTableName)
  },
  async changeColumnType (tableName: string, columnName: string, newColumnType: ColumnType, timestampFormat: string | null): Promise<Result> {
    return await datastore!.changeColumnType(tableName, columnName, newColumnType, timestampFormat)
  },
  async getAllTables (): Promise<string[]> {
    return await datastore!.getAllTables()
  },
  async reserveTableName (name: string): Promise<void> {
    await datastore!.reserveTableName(name)
  }
})
