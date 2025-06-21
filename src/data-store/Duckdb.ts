import {Datastore} from './Datastore'
import path from 'path'
import fs from 'fs'
import {Parser} from 'csv-parse'
import {
  type ColumnType,
  type CopySelection,
  type QueryColumn,
  type QueryResult,
  type QueryRow,
  type Sort
} from '../types'
import {getRandomBird} from './Birds'
import {type Env} from './worker'
import {
  DuckDBArrayType,
  DuckDBConnection,
  DuckDBInstance,
  DuckDBMaterializedResult,
  DuckDBTypeId
} from '@duckdb/node-api';

interface ColumnDetectionResult {
  columns: QueryColumn[]
  dateFormat: string
  timestampFormat: string
}

const OTHER_DATE_FORMATS = [
  '%Y-%m-%d %H:%M',
  '%d-%b-%y',
  '%d %b %y',
  '%b %d, %y'
]

for (const df of OTHER_DATE_FORMATS) {
  if (df.includes('%b')) {
    OTHER_DATE_FORMATS.push(df.replace('%b', '%B'))
  }
}

for (const df of OTHER_DATE_FORMATS) {
  if (df.includes('%y')) {
    OTHER_DATE_FORMATS.push(df.replace('%y', '%Y'))
  }
}

function convertTypeIdToSupportedUserFacingColumnType(typeId: DuckDBTypeId): string | null {
  switch (typeId) {
    case DuckDBTypeId.BIGINT:
      return 'bigint'
    case DuckDBTypeId.DOUBLE:
      return 'double'
    case DuckDBTypeId.BOOLEAN:
      return 'boolean'
    case DuckDBTypeId.VARCHAR:
      return 'varchar'
    case DuckDBTypeId.TIMESTAMP:
      return 'timestamp'
    case DuckDBTypeId.LIST:
      return 'list'
    default:
      return null
  }
}

export class Duckdb extends Datastore {
  private readonly env!: Env
  private db!: DuckDBConnection

  constructor (env: Env) {
    super()
    this.env = env
  }

  async open (): Promise<void> {
    const instance = await DuckDBInstance.create(':memory:')
    this.db = await instance.connect()
  }

  async close (): Promise<void> {
    this.db.closeSync()
  }

  private async detectColumns (filePath: string, withHeader: boolean, separator: string, autoDetect: boolean): Promise<ColumnDetectionResult> {
    const stream = fs
      .createReadStream(filePath)
      .pipe(new Parser({
        bom: true,
        trim: true,
        delimiter: separator,
        skipEmptyLines: true,
        relax: true,
        relax_column_count: true,
        toLine: 1
      }))

    const columnNames: string[] = []

    const sanitizedColumnNames = new Set<string>()
    const getColumnName = (candidate: string): string => {
      if (sanitizedColumnNames.has(candidate.toLowerCase()) || candidate.toLocaleLowerCase() === 'rowid') {
        return getColumnName(`${candidate}_dup`)
      } else {
        return candidate
      }
    }

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

    let types: string[]
    let dateFormat = ''
    let timestampFormat = ''

    if (autoDetect) {
      // sample_size = -1 would scan the whole file and makes auto detection robust. It seems to add 10% of the run time of a 800MB file.
      const result = await this.db.run(`SELECT Columns, DateFormat, TimestampFormat FROM sniff_csv('${filePath}', sample_size = -1)`)
      const sniffedRows = await result.getRowObjectsJS()
      types = (sniffedRows[0].Columns as any[]).map((c) => c.type)
      dateFormat = (sniffedRows[0].DateFormat as string | null) ?? ''
      timestampFormat = (sniffedRows[0].TimestampFormat as string | null) ?? ''
    } else {
      types = columnNames.map(() => 'varchar')
    }

    return {
      columns: columnNames.map((name, index) => {
        return {
          name,
          maxCharWidthCount: 0,
          tpe: types[index] || 'varchar'
        }
      }),
      dateFormat,
      timestampFormat
    }
  }

  private async detectAndChangeMoreColumns (table: string): Promise<void> {
    const result = await this.db.run(`SELECT * FROM "${table}" LIMIT 1`)
    const columnTypes = result.columnTypes()
    const columnNames = result.columnNames()

    for await (const [index, col] of columnTypes.entries()) {
      if (col.typeId !== DuckDBTypeId.VARCHAR) { continue }

      for (const df of OTHER_DATE_FORMATS) {
        try {
          await this.execChangeColumnType(table, columnNames[index], 'timestamp', df)
          break
        } catch (_unknown) {
          // Ignore error
        }
      }
    }
  }

  // We need this because null_padding = true and parallel = false adds an all-null line as the last line.
  private async removeLastNullLine (table: string, columns: QueryColumn[]): Promise<void> {
    const result = await this.db.run(`SELECT MAX(rowid) as rowid FROM "${table}"`)

    if (result.rowCount === 0) { return }

    const lastRowId = Number((await result.getRowObjectsJS())[0].rowid)

    await this.db.run(`DELETE FROM "${table}" where "rowid" = ${lastRowId} AND ${columns.map((c) => `"${c.name}" IS NULL`).join(' AND ')}`)
  }

  private async createCsvTable (table: string, filePath: string, withHeader: boolean, separator: string, _replace: string, autoDetectColumn: boolean): Promise<void> {
    const detectionResult = await this.detectColumns(filePath, withHeader, separator, autoDetectColumn)
    const columnsParam = `{${detectionResult.columns.map((c) => `'${c.name}': '${c.tpe}'`).join(', ')}}`

    const readCsvOptions = [
      `'${filePath}'`,
      `delim = '${separator}'`,
      `header = ${withHeader}`,
      `columns = ${columnsParam}`,
      'escape = \'"\'',
      // We already do sniff_csv. We don't need to do auto detection again.
      'auto_detect = false',
      'null_padding = true',
      // Avoid the error: The parallel scanner does not support null_padding in conjunction with quoted new lines. Please disable the parallel csv reader with parallel=false
      // This is not testable.
      'parallel = false',
      'strict_mode=false'
      // TODO: Ignoring error doesn't work well with multiline rows. No idea why. We should make it work some day.
      // 'ignore_errors = true'
      // `rejects_table = '${rejectsTable}'`
    ]
    if (detectionResult.dateFormat) {
      readCsvOptions.push(`dateformat = '${detectionResult.dateFormat}'`)
    }
    if (detectionResult.timestampFormat) {
      readCsvOptions.push(`timestampformat = '${detectionResult.timestampFormat}'`)
    }

    await this.db.run(`DROP TABLE IF EXISTS "${table}"`)
    await this.db.run(`CREATE TABLE "${table}" AS FROM read_csv(${readCsvOptions.join(', ')})`)
    await this.removeLastNullLine(table, detectionResult.columns)
  }

  async addCsv (filePath: string, withHeader: boolean, separator: string, replace: string, autoDetect: boolean): Promise<QueryResult> {
    let table = this.getTableName(path.parse(filePath).name)

    await this.createCsvTable(table, filePath, withHeader, separator, replace, autoDetect)

    if (replace && replace !== '' && table !== replace) {
      await this.drop(replace)
      await this.rename(table, replace)
      table = replace
    }

    await this.detectAndChangeMoreColumns(table)

    return await this.queryAllFromTable(table, `SELECT * FROM "${table}"`)
  }

  async exportCsv (table: string, filePath: string, delimiter: string): Promise<void> {
    await this.db.run(`COPY "${table}" TO '${filePath}' (HEADER, DELIMITER '${delimiter}')`)
  }

  async exists (table: string): Promise<boolean> {
    const numOfRowsResult = await this.db.run(`SELECT * FROM information_schema.tables where table_name = '${table}'`)
    return await Promise.resolve(numOfRowsResult.rowCount > 0)
  }

  async drop (table: string): Promise<void> {
    try {
      await this.db.run(`DROP TABLE IF EXISTS "${table}"`)

      for (let i = 0; i < this.tables.length; i++) {
        if (table === this.tables[i]) {
          this.tables.splice(i, 1)
          break
        }
      }
    } catch (_e) {
      // empty
    }
  }

  async rename (previousTableName: string, newTableName: string): Promise<void> {
    try {
      await this.db.run(`ALTER TABLE "${previousTableName}" RENAME TO "${newTableName}"`)
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

  async query (sql: string, table: string | null): Promise<QueryResult> {
    const sanitizedSql = sql.replace(/[\n\s\r ]+/g, ' ').replace(/\\"/g, '').toLocaleLowerCase()
    const isDependentOnSelf = sanitizedSql.includes(`from ${table}`) || sanitizedSql.includes(`join ${table}`)

    const newTable = this.makeQueryTableName()

    await this.db.run(`CREATE TABLE "${newTable}" AS ${sql}`)

    const result = await this.queryAllFromTable(newTable, sql)

    const shouldReplaceTable = !isDependentOnSelf && table !== null && newTable !== table
    if (shouldReplaceTable) {
      await this.drop(table)
      await this.drop(this.makeUnsortedTableName(table))
      await this.rename(newTable, table)
      result.name = table
    }

    return result
  }

  async update (sql: string, table: string): Promise<QueryResult> {
    await this.db.run(sql)

    return await this.queryAllFromTable(table, '')
  }

  async sort (table: string, sorts: Sort[]): Promise<QueryResult> {
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
      await this.db.run(`CREATE TABLE "${table}" AS ${sql}`)
      return await this.queryAllFromTable(table, sql)
    }
  }

  async copy (table: string, selection: CopySelection): Promise<{ text: string, html: string }> {
    const sql = `select ${selection.columns.map((c) => `"${c}"`).join(',')} from "${table}" limit ${selection.endRow - selection.startRow + 1} offset ${selection.startRow}`
    const result = await this.db.run(sql)
    const columnTypes = result.columnTypes()
    const rows = await result.getRowObjectsJS()

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

        if (columnTypes[i].typeId === DuckDBTypeId.TIMESTAMP) {
          value = (row[selection.columns[i]] as Date | null)?.toISOString() ?? ''
        } else if (columnTypes[i].typeId === DuckDBTypeId.LIST) {
          const pending = row[selection.columns[i]] as Array<any> | null
          if (pending !== null) {
            value = JSON.stringify(pending)
          } else {
            value = ''
          }
        } else {
          value = (row[selection.columns[i]] as string | null) ?? ''
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

  async loadMore (table: string, offset: number): Promise<QueryRow[]> {
    const result = await this.db.run(`SELECT * FROM "${table}" LIMIT ${Datastore.MAX_ROW_LOAD_MORE} OFFSET ${offset}`)
    return await this.sanitizeTable(result)
  }

  private async maybeFixColumnTypes (table: string, result: DuckDBMaterializedResult): Promise<boolean> {
    const columnTypes = result.columnTypes()
    const columnNames = result.columnNames()

    let fix = false

    const intTypes = new Set([DuckDBTypeId.SMALLINT, DuckDBTypeId.INTEGER])
    const doubleTypes = new Set([DuckDBTypeId.DECIMAL, DuckDBTypeId.FLOAT])
    const timestampTypes = new Set([DuckDBTypeId.TIME, DuckDBTypeId.DATE])

    for await (const [index, columnType] of columnTypes.entries()) {
      const tpe = convertTypeIdToSupportedUserFacingColumnType(columnType.typeId)
      if (tpe !== null) {continue}

      if (intTypes.has(columnType.typeId)) {
        await this.execChangeColumnType(table, columnNames[index], 'BIGINT')
      } else if (doubleTypes.has(columnType.typeId)) {
        await this.execChangeColumnType(table, columnNames[index], 'DOUBLE')
      } else if (timestampTypes.has(columnType.typeId)) {
        await this.execChangeColumnType(table, columnNames[index], 'TIMESTAMP')
      } else if (columnType.typeId === DuckDBTypeId.ARRAY) {
        const arrayType = columnType as DuckDBArrayType
        await this.execChangeColumnType(table, columnNames[index], `${arrayType.valueType.toString()}[]`)
      } else {
        throw new Error(`Unable to normalize the data type: ${tpe} of the column ${columnNames[index]} in the table ${table}`)
      }

      fix = true
    }
    return fix
  }

  private async sanitizeTable (result: DuckDBMaterializedResult): Promise<any[][]> {
    const values = await result.getRowObjectsJS()
    const columnNames = result.columnNames()

    return values.map((r) => {
      return columnNames.map((columnName) => {
        return r[columnName]
      })
    })
  }

  private async queryAllFromTable (table: string, sql: string): Promise<QueryResult> {
    const numOfRowsResult = await this.db.run(`SELECT COUNT(*) AS number_of_rows FROM "${table}"`)
    const numOfRows = numOfRowsResult.rowCount === 0 ? 0 : Number((await numOfRowsResult.getRowObjectsJS())[0].number_of_rows)

    const result = await this.db.run(`SELECT * FROM "${table}" LIMIT ${Datastore.MAX_ROW}`)

    if (await this.maybeFixColumnTypes(table, result)) {
      return await this.queryAllFromTable(table, sql)
    }

    const columnTypes = result.columnTypes()
    const columnNames = result.columnNames()
    const sampleSql = `SELECT * FROM "${table}" USING SAMPLE 100`
    const lengthClauses = columnTypes.map((colType, index) => {
      if (colType.typeId === DuckDBTypeId.TIMESTAMP) {
        // Example: Mon Mar 18 2024 10:59:00 GMT-0700 (Pacific Daylight Time)
        return `25 as "${columnNames[index]}"`
      } else {
        return `MAX(COALESCE(NULLIF(INSTR(CAST("${columnNames[index]}" AS text), x'0a'), 0), LENGTH(CAST("${columnNames[index]}" AS text)))) AS "${columnNames[index]}"`
      }
    })
    const metadataSql = `SELECT ${lengthClauses.join(',')} FROM (${sampleSql})`
    const metadataResult = await this.db.run(metadataSql)

    const columns: QueryColumn[] = columnTypes.map((colType, index) => {
      const userFacingType = convertTypeIdToSupportedUserFacingColumnType(colType.typeId)
      if (userFacingType === null) {
        throw new Error(`The column ${columnNames[index]} of the table ${table} has an unsupported column type: ${colType.typeId}`)
      }

      return {
        name: columnNames[index],
        maxCharWidthCount: 0,
        tpe: userFacingType
      }
    })

    const allRows = await this.sanitizeTable(result)

    if (metadataResult.rowCount > 0) {
      const columnMap = {}
      for (const col of columns) {
        columnMap[col.name] = col
      }

      const row = (await metadataResult.getRowObjectsJS())[0]
      for (const key in row) {
        if (row[key] && Object.prototype.hasOwnProperty.call(columnMap, key)) {
          columnMap[key].maxCharWidthCount = Number(row[key])
        }
      }
    }

    return {
      name: table,
      sql,
      columns,
      rows: allRows,
      count: numOfRows
    }
  }

  private async execChangeColumnType (tableName: string, columnName: string, newColumnType: ColumnType, timestampFormat: string | null = null): Promise<void> {
    let usingClause = ''

    if (newColumnType === 'timestamp') {
      usingClause = `USING strptime("${columnName}", '${timestampFormat}')`
    }

    await this.db.run(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET DATA TYPE ${newColumnType} ${usingClause}`)
  }

  async changeColumnType (tableName: string, columnName: string, newColumnType: ColumnType, timestampFormat: string | null): Promise<QueryResult> {
    await this.execChangeColumnType(tableName, columnName, newColumnType, timestampFormat)

    return await this.queryAllFromTable(tableName, `SELECT * FROM "${tableName}"`)
  }

  async getAllTables (): Promise<string[]> {
    return await this._getAllTables()
  }

  async reserveTableName (name: string): Promise<void> {
    await this._reserveTableName(name)
  }

  async import (dirPath: string): Promise<void> {
    await this.db.run(`IMPORT DATABASE '${this.escapeValue(dirPath)}'`)
  }

  async export (dirPath: string): Promise<void> {
    await this.db.run(`EXPORT DATABASE '${this.escapeValue(dirPath)}' (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 100000)`)
  }

  async loadTable (table: string): Promise<QueryResult> {
    return await this.queryAllFromTable(table, 'dontcare')
  }

  private escapeValue (s: string): string {
    return s.replace(/'/g, "\\'")
  }
}
