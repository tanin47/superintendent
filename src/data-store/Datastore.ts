import { type QueryResult, type ColumnType, type CopySelection, type Sort, type QueryRow } from '../types'
import { getRandomBird } from './Birds'

export abstract class Datastore {
  static MAX_ROW = 1000
  static MAX_ROW_LOAD_MORE = 10000

  protected tables: string[] = []

  abstract open (): Promise<void>
  abstract close (): Promise<void>

  abstract addCsv (filePath: string, withHeader: boolean, separator: string, replace: string): Promise<QueryResult>
  abstract exportCsv (table: string, filePath: string, delimiter: string): Promise<void>

  abstract query (sql: string, table: string | null): Promise<QueryResult>
  abstract sort (table: string, sorts: Sort[]): Promise<QueryResult>
  abstract copy (table: string, selection: CopySelection): Promise<{ text: string, html: string }>
  abstract loadMore (table: string, offset: number): Promise<QueryRow[]>
  abstract drop (table: string): Promise<void>
  abstract rename (previousTableName: string, newTableName: string): Promise<void>
  abstract changeColumnType (tableName: string, columnName: string, newColumnType: ColumnType, timestampFormat: string | null): Promise<QueryResult>
  abstract getAllTables (): Promise<string[]>
  abstract reserveTableName (name: string): Promise<void>
  abstract loadTable (table: string): Promise<QueryResult>
  abstract import (dirPath: string): Promise<void>
  abstract export (dirPath: string): Promise<void>

  // The Sqlite is running on a different thread.
  // Even though this method doesn't require the async approach, we still need to call it through a worker.
  protected async _getAllTables (): Promise<string[]> {
    return await Promise.resolve(this.tables)
  }

  protected async _reserveTableName (name: string): Promise<void> {
    this.tables.push(name)
    await Promise.resolve()
  }

  static sanitizeName (name: string): string {
    let sanitized = name.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+/g, '').replace(/_+$/g, '')

    if (sanitized === '') { sanitized = 'empty' }

    return sanitized
  }

  protected getTableName (name: string, number: number | null = null): string {
    return this.getUniqueTableName(Datastore.sanitizeName(name), number)
  }

  protected getUniqueTableName (base: string, number: number | null = null): string {
    const candidate = base + (number ? `_${number}` : '')
    const sanitizedCandidate = candidate.toLowerCase()
    for (const table of this.tables) {
      if (sanitizedCandidate === table.toLowerCase()) {
        return this.getUniqueTableName(base, (number ?? 0) + 1)
      }
    }
    this.tables.push(candidate)
    return candidate
  }

  protected makeQueryTableName (): string {
    return this.getTableName(getRandomBird())
  }

  protected makeUnsortedTableName (name: string): string {
    return `${name}___unsorted`
  }
}
