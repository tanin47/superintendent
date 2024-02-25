import { Datastore, type Result, type Row } from './Datastore'
import path from 'path'
import { spawn, Thread, Worker } from 'threads'
import { type DatabaseEngine, type CopySelection, type Sort } from '../types'

// Every method must be called through the worker because this runs on a different thread.
export class Workerize extends Datastore {
  private readonly worker: Datastore

  constructor (worker: Datastore) {
    super()
    this.worker = worker
  }

  static async create (databaseEngine: DatabaseEngine): Promise<Datastore> {
    const prefix = process.env.SUPERINTENDENT_IS_PROD ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'prod') : '.'

    const worker = (await spawn(new Worker(path.join(prefix, 'worker')))) as any
    await worker.init({ resourcePath: process.resourcesPath, platform: process.platform, databaseEngine })
    return await Promise.resolve(new Workerize(worker as Datastore))
  }

  async open (): Promise<void> {
    await this.worker.open()
  }

  async close (): Promise<void> {
    await this.worker.close()
    await Thread.terminate(this.worker as any)
  }

  async addSqlite (filePath: string): Promise<Result[]> {
    return await this.worker.addSqlite(filePath)
  }

  async addCsv (filePath: string, withHeader: boolean, separator: string, replace: string): Promise<Result[]> {
    return await this.worker.addCsv(filePath, withHeader, separator, replace)
  }

  async exportCsv (table: string, filePath: string, delimiter: string): Promise<void> {
    await this.worker.exportCsv(table, filePath, delimiter)
  }

  async query (sql: string, table: string | null): Promise<Result> {
    return await this.worker.query(sql, table)
  }

  async sort (table: string, sorts: Sort[]): Promise<Result> {
    return await this.worker.sort(table, sorts)
  }

  async copy (table: string, selection: CopySelection): Promise<{ text: string, html: string }> {
    return await this.worker.copy(table, selection)
  }

  async loadMore (table: string, offset: number): Promise<Row[]> {
    return await this.worker.loadMore(table, offset)
  }

  async drop (table: string): Promise<void> {
    await this.worker.drop(table)
  }

  async rename (previousTableName: string, newTableName: string): Promise<void> {
    await this.worker.rename(previousTableName, newTableName)
  }

  async getAllTables (): Promise<string[]> {
    return await this.worker.getAllTables()
  }

  async reserveTableName (name: string): Promise<void> {
    await this.worker.reserveTableName(name)
  }
}
