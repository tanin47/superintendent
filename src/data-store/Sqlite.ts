import { type Column, Datastore, type Result, type Row } from './Datastore'
import sqlite, { type Database } from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { Parser } from 'csv-parse'
import { type CopySelection, type Sort } from '../types'
import { getRandomBird } from './Birds'

export interface Env {
  resourcePath: string
  platform: string
}

export class Sqlite extends Datastore {
  private readonly env!: Env
  private db!: Database

  constructor (env: Env) {
    super()
    this.env = env
    this.open()
  }

  private open (): void {
    this.db = sqlite('') // temporary mode
    this.db.pragma('journal_mode = OFF;')
    this.db.pragma('synchronous = OFF;')
    this.db.pragma('locking_mode = EXCLUSIVE;')

    const prefix = process.env.SUPERINTENDENT_IS_PROD ? this.env.resourcePath : '.'
    let ext = 'dylib'

    switch (this.env.platform) {
      case 'darwin':
        ext = 'dylib'
        break
      case 'linux':
        ext = 'so'
        break
      case 'win32':
        ext = 'dll'
        break
      default:
        throw new Error(`The platform ${this.env.platform} is not supported.`)
    }

    this.db.loadExtension(path.join(prefix, 'deps', 'ext', `ext.${ext}`))
    this.db.loadExtension(path.join(prefix, 'deps', 'csv', `csv.${ext}`))
    this.db.loadExtension(path.join(prefix, 'deps', 'csv_writer', `csv_writer.${ext}`))
  }

  async close (): Promise<void> {
    this.db.close()
  }

  async addSqlite (filePath: string): Promise<Result[]> {
    this.db.exec(`ATTACH DATABASE '${filePath}' AS temp_database;`)

    const rows = this.db.prepare('SELECT tbl_name FROM temp_database.sqlite_master WHERE type = \'table\';').raw(true).all()

    const results: Result[] = []

    for (const row of rows) {
      const oldName = row[0] as string
      const table = this.getTableName(oldName)
      this.db.exec(`CREATE TABLE "${table}" AS SELECT * FROM "temp_database"."${oldName}"`)
      results.push(this.queryAllFromTable(table, `SELECT * FROM "${table}"`))
    }

    this.db.exec('DETACH DATABASE temp_database;')

    return results
  }

  async addCsv (filePath: string, withHeader: boolean, separator: string, replace: string): Promise<Result[]> {
    let table = this.getTableName(path.parse(filePath).name)

    const stream = fs
      .createReadStream(filePath)
      .pipe(new Parser({
        bom: true,
        trim: true,
        delimiter: separator,
        skipEmptyLines: true,
        relax: true,
        relax_column_count: true
      }))

    const columns: string[] = []

    const sanitizedColumnNames = new Set<string>()
    const getColumnName = (candidate: string): string => {
      if (sanitizedColumnNames.has(candidate.toLowerCase())) {
        return getColumnName(`${candidate}_dup`)
      } else {
        return candidate
      }
    }

    // eslint-disable-next-line no-unreachable-loop
    for await (const row of stream) {
      row.forEach((candidate: string) => {
        if (!withHeader) {
          candidate = getRandomBird()
        }

        const newName = getColumnName(this.sanitizeName(candidate))

        columns.push(newName)
        sanitizedColumnNames.add(newName.toLowerCase())
      })
      break
    }
    const createTable = `CREATE TABLE x(${columns.map((c) => `"${c}" TEXT`).join(', ')})`

    const virtualTable = this.getTableName('virtual_' + table)
    this.db.exec(`CREATE VIRTUAL TABLE "${virtualTable}" USING csv(filename='${filePath}', header=${withHeader}, schema='${createTable}', separator='${separator}')`)
    this.db.exec(`CREATE TABLE "${table}" AS SELECT * FROM "${virtualTable}"`)
    await this.drop(virtualTable)

    if (replace && replace !== '' && table !== replace) {
      await this.drop(replace)
      await this.rename(table, replace)
      table = replace
    }

    const result = this.queryAllFromTable(table, `SELECT * FROM "${table}"`)
    result.isCsv = true
    result.sql = ''
    return [result]
  }

  async exportCsv (table: string, filePath: string, delimiter: string): Promise<void> {
    let columns: string[]
    {
      const statement = this.db.prepare(`SELECT * FROM "${table}" LIMIT 1`).raw(true)

      columns = statement.columns().map((c) => c.name)

      const iterator = statement.iterate()
      while (true) {
        const { done } = iterator.next() // drain it
        if (done) {
          break
        }
      }
    }

    this.db.exec(`CREATE VIRTUAL TABLE "temp_table_name" USING csv_writer(filename='${filePath}', columns='${columns!.join(',')}', separator='${delimiter}')`)
    this.db.exec(`INSERT INTO "temp_table_name" SELECT * FROM "${table}"`)
    this.db.exec('DROP TABLE "temp_table_name"')

    await Promise.resolve()
  }

  async exists (table: string): Promise<boolean> {
    const numOfRowsResult = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").all(table)
    return await Promise.resolve(numOfRowsResult.length > 0)
  }

  async drop (table: string): Promise<void> {
    try {
      this.db.exec(`DROP TABLE IF EXISTS "${table}"`)

      for (let i = 0; i < this.tables.length; i++) {
        if (table === this.tables[i]) {
          this.tables.splice(i, 1)
          break
        }
      }
    } catch (e) { }
  }

  async rename (previousTableName: string, newTableName: string): Promise<void> {
    try {
      this.db.exec(`ALTER TABLE "${previousTableName}" RENAME TO "${newTableName}"`)
    } catch (e) {
      await Promise.reject(e); return
    }

    for (let i = 0; i < this.tables.length; i++) {
      if (previousTableName === this.tables[i]) {
        this.tables.splice(i, 1, newTableName)
        break
      }
    }
  }

  async query (sql: string, table: string | null): Promise<Result> {
    const dependsOn: string[] = []
    const explain = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all()
    for (const item of explain) {
      if (item.detail.startsWith('SCAN TABLE ') || item.detail.startsWith('SEARCH TABLE ')) {
        const components = item.detail.split(' ', 3) as string[]
        dependsOn.push(components[2])
      }
    }

    const isDependentOnSelf = dependsOn.findIndex((d) => d === table) > -1

    const newTable = this.makeQueryTableName()

    this.db.exec(`CREATE TABLE "${newTable}" AS ${sql}`)

    const result = this.queryAllFromTable(newTable, sql)
    result.dependsOn = dependsOn
    result.isCsv = false

    const shouldReplaceTable = !isDependentOnSelf && table !== null && newTable !== table
    if (shouldReplaceTable) {
      await this.drop(table)
      await this.drop(this.makeUnsortedTableName(table))
      await this.rename(newTable, table)
      result.name = table
    }

    return result
  }

  async sort (table: string, sorts: Sort[]): Promise<Result> {
    const filteredSorts = sorts.filter((s) => s.direction !== 'none')
    const unsortedTable = this.makeUnsortedTableName(table)

    if (filteredSorts.length === 0) {
      if (await this.exists(unsortedTable)) {
        await this.drop(table)
        await this.rename(unsortedTable, table)
      } else {
        // do nothing.
      }

      return this.queryAllFromTable(table, `SELECT * FROM "${table}"`)
    } else {
      if (!await this.exists(unsortedTable)) {
        await this.rename(table, unsortedTable)
      }
      await this.drop(table)

      const orderClause = filteredSorts
        .map((s) => `"${s.name}" ${s.direction}`)
        .join(', ')

      const sql = `SELECT * FROM "${unsortedTable}" ORDER BY ${orderClause}`
      this.db.exec(`CREATE TABLE "${table}" AS ${sql}`)
      return this.queryAllFromTable(table, sql)
    }
  }

  async copy (table: string, selection: CopySelection): Promise<{ text: string, html: string }> {
    const sql = `select ${selection.columns.map((c) => `"${c}"`).join(',')} from "${table}" limit ${selection.endRow - selection.startRow + 1} offset ${selection.startRow}`
    const statement = this.db.prepare(sql).raw(true)

    let html = ''
    let text = ''

    html += '<table style="border-collapse: collapse;">'

    if (selection.includeColumnNames) {
      html += '<tr>'

      if (selection.includeRowNumbers) {
        html += '<th style="border: 1px solid #ccc;">*</th>'
      }

      for (let i = 0; i < selection.columns.length; i++) {
        html += '<th style="border: 1px solid #ccc;">'
        html += selection.columns[i]
        html += '</th>'

        if (i > 0) {
          text += ','
        }
        text += selection.columns[i]
      }

      html += '</tr>'
    }

    let count = 0

    for (const row of statement.iterate()) {
      if (text !== '') {
        text += '\n'
      }

      const textItems: string[] = []
      const htmlItems: string[] = []

      html += '<tr>'

      if (selection.includeRowNumbers) {
        html += `<td style="border: 1px solid #ccc;">${selection.startRow + 1 + count++}</td>`
      }

      for (let i = 0; i < row.length; i++) {
        htmlItems.push('<td style="border: 1px solid #ccc;">')

        textItems.push(row[i] as string)
        htmlItems.push(row[i] as string)

        htmlItems.push('</td>')
      }

      text += textItems.join(',')
      html += htmlItems.join('')
      html += '</tr>'
    }

    html += '</table>'

    return await Promise.resolve({ text, html })
  }

  async loadMore (table: string, offset: number): Promise<Row[]> {
    const statement = this.db.prepare(`SELECT * FROM "${table}" LIMIT ${Datastore.MAX_ROW_LOAD_MORE} OFFSET ${offset}`).raw(true)
    const allRows = statement.all()

    return await Promise.resolve(allRows)
  }

  private queryAllFromTable (table: string, sql: string): Result {
    const numOfRowsResult = this.db.prepare(`SELECT COUNT(*) AS number_of_rows FROM "${table}"`).all()
    const numOfRows = numOfRowsResult.length === 0 ? 0 : (numOfRowsResult[0].number_of_rows as number)

    const statement = this.db.prepare(`SELECT * FROM "${table}" LIMIT ${Datastore.MAX_ROW}`).raw(true)
    const allRows = statement.all()

    let previewedNumOfRows = Math.min(numOfRows, Datastore.MAX_ROW)

    if (previewedNumOfRows < 100) {
      previewedNumOfRows = 100
    }

    const columnNames = statement.columns().map((c) => c.name)
    const sampleSql = `SELECT * FROM (SELECT rowid, * FROM "${table}" LIMIT ${Datastore.MAX_ROW}) WHERE ((rowid - 1) % ${Math.ceil(previewedNumOfRows / 100)}) = 0 OR rowid = ${previewedNumOfRows}`
    const metdataSql = `SELECT ${columnNames.map((col) => { return `MAX(COALESCE(NULLIF(INSTR(CAST("${col}" AS text), x'0a'), 0), LENGTH(CAST("${col}" AS text)))) AS "${col}"` }).join(',')} FROM (${sampleSql})`

    const metadataResult = this.db.prepare(metdataSql).all()

    const columns: Column[] = columnNames.map((col) => {
      return {
        name: col,
        maxCharWidthCount: 0
      }
    })

    if (metadataResult.length > 0) {
      const columnMap = {}
      for (const col of columns) {
        columnMap[col.name] = col
      }

      for (const key in metadataResult[0]) {
        if (Object.prototype.hasOwnProperty.call(metadataResult[0], key) && Object.prototype.hasOwnProperty.call(columnMap, key)) {
          columnMap[key].maxCharWidthCount = metadataResult[0][key] || 0
        }
      }
    }

    return {
      name: table,
      sql,
      columns,
      rows: allRows,
      count: numOfRows,
      dependsOn: [],
      isCsv: false
    }
  }

  async getAllTables (): Promise<string[]> {
    return await this._getAllTables()
  }

  async reserveTableName (name: string): Promise<void> {
    await this._reserveTableName(name)
  }
}
