import { type ColumnType, type CopySelection, type Sort } from '../types'
import { getRandomBird } from './Birds'

export interface Column {
  name: string
  maxCharWidthCount: number
  tpe: ColumnType
}
export type Row = string[]

export interface Result {
  name: string
  sql: string
  columns: Column[]
  rows: Row[]
  count: number
  isCsv: boolean
}

export abstract class Datastore {
  static MAX_ROW = 1000
  static MAX_ROW_LOAD_MORE = 10000

  protected tables: string[] = []

  abstract open (): Promise<void>
  abstract close (): Promise<void>

  abstract addCsv (filePath: string, withHeader: boolean, separator: string, replace: string): Promise<Result[]>
  abstract exportCsv (table: string, filePath: string, delimiter: string): Promise<void>

  abstract query (sql: string, table: string | null): Promise<Result>
  abstract sort (table: string, sorts: Sort[]): Promise<Result>
  abstract copy (table: string, selection: CopySelection): Promise<{ text: string, html: string }>
  abstract loadMore (table: string, offset: number): Promise<Row[]>
  abstract drop (table: string): Promise<void>
  abstract rename (previousTableName: string, newTableName: string): Promise<void>
  abstract changeColumnType (tableName: string, columnName: string, newColumnType: ColumnType, timestampFormat: string | null): Promise<Result>
  abstract getAllTables (): Promise<string[]>
  abstract reserveTableName (name: string): Promise<void>

  // The Sqlite is running on a different thread.
  // Even though this method doesn't require the async approach, we still need to call it through a worker.
  protected async _getAllTables (): Promise<string[]> {
    return await Promise.resolve(this.tables)
  }

  protected async _reserveTableName (name: string): Promise<void> {
    this.tables.push(name)
    await Promise.resolve()
  }

  protected sanitizeName (name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_')
  }

  protected getTableName (name: string, number: number | null = null): string {
    return this.getUniqueTableName(this.sanitizeName(name), number)
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
