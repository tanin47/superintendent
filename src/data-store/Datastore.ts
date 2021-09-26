
export type Column = {
  name: string,
  maxCharWidthCount: number
};
export type Row = string[];

export type Result = {
  name: string,
  sql: string,
  columns: Column[],
  rows: Row[],
  count: number,
}

export abstract class Datastore {
  static MAX_ROW = 186282;

  protected tables: Array<string> = [];

  abstract addSqlite(filePath: string, evaluationMode: boolean): Promise<Result[]>;
  abstract addCsv(filePath: string, separator: string, evaluationMode: boolean): Promise<Result[]>;
  abstract exportCsv(table: string, filePath: string): Promise<void>;

  abstract exportSchema(filePath: string): Promise<void>;

  abstract query(sql: string): Promise<Result>;
  abstract drop(table: string): Promise<void>;
  abstract rename(previousTableName: string, newTableName: string): Promise<void>;

  protected sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  protected getTableName(name: string, number: number | null = null): string {
    return this.getUniqueTableName(this.sanitizeName(name), number);
  }

  protected getUniqueTableName(base: string, number: number | null = null): string {
    const candidate = base + (number ? `_${number}` : '');
    const sanitizedCandidate = candidate.toLowerCase()
    for (const table of this.tables) {
      if (sanitizedCandidate === table.toLowerCase()) {
        return this.getUniqueTableName(base, (number || 0) + 1);
      }
    }
    this.tables.push(candidate);
    return candidate;
  }

  protected makeQueryTableName(): string {
    return this.getTableName('query', 1);
  }
}
