import { expose } from 'threads/worker'
import { Duckdb } from './Duckdb'
import { type Datastore } from './Datastore'
import { type CopySelection, type Sort, type ColumnType, type QueryResult, type QueryRow } from '../types'

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
  async addCsv (filePath: string, withHeader: boolean, separator: string, replace: string): Promise<QueryResult> {
    return await datastore!.addCsv(filePath, withHeader, separator, replace)
  },
  async exportCsv (table: string, filePath: string, delimiter: string): Promise<void> {
    await datastore!.exportCsv(table, filePath, delimiter)
  },
  async query (sql: string, table: string | null): Promise<QueryResult> {
    return await datastore!.query(sql, table)
  },
  async update (sql: string, table: string): Promise<QueryResult> {
    return await datastore!.update(sql, table)
  },
  async sort (table: string, sorts: Sort[]): Promise<QueryResult> {
    return await datastore!.sort(table, sorts)
  },
  async copy (table: string, selection: CopySelection): Promise<{ text: string, html: string }> {
    return await datastore!.copy(table, selection)
  },
  async loadMore (table: string, offset: number): Promise<QueryRow[]> {
    return await datastore!.loadMore(table, offset)
  },
  async drop (table: string): Promise<void> {
    await datastore!.drop(table)
  },
  async rename (previousTableName: string, newTableName: string): Promise<void> {
    await datastore!.rename(previousTableName, newTableName)
  },
  async changeColumnType (tableName: string, columnName: string, newColumnType: ColumnType, timestampFormat: string | null): Promise<QueryResult> {
    return await datastore!.changeColumnType(tableName, columnName, newColumnType, timestampFormat)
  },
  async getAllTables (): Promise<string[]> {
    return await datastore!.getAllTables()
  },
  async reserveTableName (name: string): Promise<void> {
    await datastore!.reserveTableName(name)
  },
  async import (dirPath: string): Promise<void> {
    await datastore!.import(dirPath)
  },
  async export (dirPath: string): Promise<void> {
    await datastore!.export(dirPath)
  },
  async loadTable (table: string): Promise<QueryResult> {
    return await datastore!.loadTable(table)
  }
})
