import { type Column, Datastore, type Result, type Row } from './Datastore'
import { Database } from 'duckdb-async'
import { type ColumnInfo } from 'duckdb'
import path from 'path'
import fs from 'fs'
import { Parser } from 'csv-parse'
import { ColumnTypes, type ColumnType, type CopySelection, type Sort } from '../types'
import { getRandomBird } from './Birds'
import { type Env } from './worker'

interface ColumnDetectionResult {
  columns: Column[]
  dateFormat: string
  timestampFormat: string
}

export class Duckdb extends Datastore {
  private readonly env!: Env
  private db!: Database

  constructor (env: Env) {
    super()
    this.env = env
  }

  async open (): Promise<void> {
    this.db = await Database.create(':memory:')
  }

  async close (): Promise<void> {
    await this.db.close()
  }

  private async detectColumns (filePath: string, withHeader: boolean, separator: string): Promise<ColumnDetectionResult> {
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

    const columnNames: string[] = []

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

        const newName = getColumnName(Datastore.sanitizeName(candidate))

        columnNames.push(newName)
        sanitizedColumnNames.add(newName.toLowerCase())
      })
      break
    }

    const sniffedRows = await this.db.all(`SELECT Columns, DateFormat, TimestampFormat FROM sniff_csv('${filePath}')`)
    const types = sniffedRows[0].Columns.match(/(: '([a-zA-Z]+)')/g).map((matched: string) => matched.substring(3, matched.length - 1))
    const dateFormat = sniffedRows[0].DateFormat ?? ''
    const timestampFormat = sniffedRows[0].TimestampFormat ?? ''

    return {
      columns: columnNames.map((name, index) => {
        return {
          name,
          maxCharWidthCount: 0,
          tpe: types[index]
        }
      }),
      dateFormat,
      timestampFormat
    }
  }

  async addCsv (filePath: string, withHeader: boolean, separator: string, replace: string): Promise<Result[]> {
    let table = this.getTableName(path.parse(filePath).name)
    const detectionResult = await this.detectColumns(filePath, withHeader, separator)
    const columnsParam = `{${detectionResult.columns.map((c) => `'${c.name}': '${c.tpe}'`).join(', ')}}`

    const readCsvOptions = [
      `'${filePath}'`,
      `delim = '${separator}'`,
      `header = ${withHeader}`,
      `columns = ${columnsParam}`,
      'all_varchar = true',
      'null_padding = true'
    ]
    if (detectionResult.dateFormat) {
      readCsvOptions.push(`dateformat = '${detectionResult.dateFormat}'`)
    }
    if (detectionResult.timestampFormat) {
      readCsvOptions.push(`timestampformat = '${detectionResult.timestampFormat}'`)
    }
    await this.db.exec(`CREATE TABLE "${table}" AS FROM read_csv(${readCsvOptions.join(', ')})`)

    if (replace && replace !== '' && table !== replace) {
      await this.drop(replace)
      await this.rename(table, replace)
      table = replace
    }

    const result = await this.queryAllFromTable(table, `SELECT * FROM "${table}"`)
    result.isCsv = true
    result.sql = ''
    return [result]
  }

  async exportCsv (table: string, filePath: string, delimiter: string): Promise<void> {
    await this.db.exec(`COPY "${table}" TO '${filePath}' (HEADER, DELIMITER '${delimiter}')`)
  }

  async exists (table: string): Promise<boolean> {
    const numOfRowsResult = await this.db.all(`SELECT * FROM information_schema.tables where table_name = '${table}'`)
    return await Promise.resolve(numOfRowsResult.length > 0)
  }

  async drop (table: string): Promise<void> {
    try {
      await this.db.exec(`DROP TABLE IF EXISTS "${table}"`)

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
      await this.db.exec(`ALTER TABLE "${previousTableName}" RENAME TO "${newTableName}"`)
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
    const sanitizedSql = sql.replace(/[\n\s\r ]+/g, ' ').replace(/\\"/g, '').toLocaleLowerCase()
    const isDependentOnSelf = sanitizedSql.includes(`from ${table}`) || sanitizedSql.includes(`join ${table}`)

    const newTable = this.makeQueryTableName()

    await this.db.exec(`CREATE TABLE "${newTable}" AS ${sql}`)

    const result = await this.queryAllFromTable(newTable, sql)
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

      return await this.queryAllFromTable(table, `SELECT * FROM "${table}"`)
    } else {
      if (!await this.exists(unsortedTable)) {
        await this.rename(table, unsortedTable)
      }
      await this.drop(table)

      const orderClause = filteredSorts
        .map((s) => `"${s.name}" ${s.direction}`)
        .join(', ')

      const sql = `SELECT * FROM "${unsortedTable}" ORDER BY ${orderClause}`
      await this.db.exec(`CREATE TABLE "${table}" AS ${sql}`)
      return await this.queryAllFromTable(table, sql)
    }
  }

  async copy (table: string, selection: CopySelection): Promise<{ text: string, html: string }> {
    const sql = `select ${selection.columns.map((c) => `"${c}"`).join(',')} from "${table}" limit ${selection.endRow - selection.startRow + 1} offset ${selection.startRow}`
    const statement = await this.db.prepare(sql)
    const columnInfos = statement.columns()
    const rows = await statement.all()

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

    for (const row of rows) {
      if (text !== '') {
        text += '\n'
      }

      const textItems: string[] = []
      const htmlItems: string[] = []

      html += '<tr>'

      if (selection.includeRowNumbers) {
        html += `<td style="border: 1px solid #ccc;">${selection.startRow + 1 + count++}</td>`
      }

      for (let i = 0; i < selection.columns.length; i++) {
        htmlItems.push('<td style="border: 1px solid #ccc;">')

        let value: string

        if (columnInfos[i].type.id.toLocaleLowerCase() === 'timestamp') {
          value = (row[selection.columns[i]] as Date).toISOString()
        } else {
          value = row[selection.columns[i]] as string
        }

        textItems.push(value)
        htmlItems.push(value)

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
    const statement = await this.db.prepare(`SELECT * FROM "${table}" LIMIT ${Datastore.MAX_ROW_LOAD_MORE} OFFSET ${offset}`)
    const columns = statement.columns()
    const rows = await statement.all()

    return await Promise.resolve(rows.map((r) => columns.map((c) => r[c.name])))
  }

  private async maybeFixColumnTypes (table: string, columns: ColumnInfo[]): Promise<boolean> {
    let fix = false

    for await (const column of columns) {
      const tpe = column.type.id.toLocaleLowerCase()
      if (ColumnTypes.includes(tpe)) { continue }

      if (tpe === 'integer') {
        await this.execChangeColumnType(table, column.name, 'BIGINT')
      } else if (tpe === 'decimal') {
        await this.execChangeColumnType(table, column.name, 'DOUBLE')
      } else if (tpe === 'time' || tpe === 'date') {
        await this.execChangeColumnType(table, column.name, 'TIMESTAMP')
      } else {
        throw new Error(`Unable to normalize the data type: ${tpe} of the column ${column.name} in the table ${table}`)
      }

      fix = true
    }
    return fix
  }

  private async queryAllFromTable (table: string, sql: string): Promise<Result> {
    const numOfRowsResult = await this.db.all(`SELECT COUNT(*) AS number_of_rows FROM "${table}"`)
    const numOfRows = numOfRowsResult.length === 0 ? 0 : Number(numOfRowsResult[0].number_of_rows)

    const statement = await this.db.prepare(`SELECT * FROM "${table}" LIMIT ${Datastore.MAX_ROW}`)
    const columnInfos = statement.columns()

    if (await this.maybeFixColumnTypes(table, columnInfos)) {
      return await this.queryAllFromTable(table, sql)
    }

    const sampleSql = `SELECT * FROM "${table}" USING SAMPLE 100`
    const lengthClauses = columnInfos.map((col) => {
      if (col.type.id.toLocaleLowerCase() === 'timestamp') {
        // Example: Mon Mar 18 2024 10:59:00 GMT-0700 (Pacific Daylight Time)
        return `25 as "${col.name}"`
      } else {
        return `MAX(COALESCE(NULLIF(INSTR(CAST("${col.name}" AS text), x'0a'), 0), LENGTH(CAST("${col.name}" AS text)))) AS "${col.name}"`
      }
    })
    const metdataSql = `SELECT ${lengthClauses.join(',')} FROM (${sampleSql})`

    const metadataResult = await this.db.all(metdataSql)

    const columns: Column[] = columnInfos.map((col) => {
      const colType = col.type.id.toLocaleLowerCase()
      if (!ColumnTypes.includes(colType)) {
        throw new Error(`The column ${col.name} of the table ${table} has an unsupported column type: ${col.type.id.toLocaleLowerCase()}`)
      }

      return {
        name: col.name,
        maxCharWidthCount: 0,
        tpe: colType
      }
    })

    const allRows = (await statement.all())
      .map((r) => {
        return columns.map((c) => {
          if (c.tpe === 'timestamp') {
            return r[c.name].getTime()
          } else {
            return r[c.name]
          }
        })
      })

    if (metadataResult.length > 0) {
      const columnMap = {}
      for (const col of columns) {
        columnMap[col.name] = col
      }

      for (const key in metadataResult[0]) {
        if (Object.prototype.hasOwnProperty.call(metadataResult[0], key) && Object.prototype.hasOwnProperty.call(columnMap, key)) {
          columnMap[key].maxCharWidthCount = Number(metadataResult[0][key]) || 0
        }
      }
    }

    return {
      name: table,
      sql,
      columns,
      rows: allRows,
      count: numOfRows,
      isCsv: false
    }
  }

  private async execChangeColumnType (tableName: string, columnName: string, newColumnType: string, timestampFormat: string | null = null): Promise<void> {
    let usingClause = ''

    if (newColumnType === 'timestamp') {
      usingClause = `USING strptime("${columnName}", '${timestampFormat}')`
    }

    await this.db.exec(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET DATA TYPE ${newColumnType} ${usingClause}`)
  }

  async changeColumnType (tableName: string, columnName: string, newColumnType: ColumnType, timestampFormat: string | null): Promise<Result> {
    await this.execChangeColumnType(tableName, columnName, newColumnType, timestampFormat)

    const result = await this.queryAllFromTable(tableName, `SELECT * FROM "${tableName}"`)
    result.isCsv = false
    return result
  }

  async getAllTables (): Promise<string[]> {
    return await this._getAllTables()
  }

  async reserveTableName (name: string): Promise<void> {
    await this._reserveTableName(name)
  }
}
