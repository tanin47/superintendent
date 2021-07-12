
export type Column = string;
export type Row = string[];

export type Result = {
  name: string,
  sql: string,
  columns: Column[],
  rows: Row[],
  count: number,
}

export abstract class Datastore {
  static MAX_ROW = 1000;
  static MAX_CHARACTERS = 300000;

  protected tables: Array<string> = [];

  abstract addCsv(filePath: string, evaluationMode: boolean): Promise<Result>;
  abstract exportCsv(table: string, filePath: string): Promise<void>;

  abstract query(sql: string): Promise<Result>;
  abstract drop(table: string): Promise<void>;

  static makePreview(columns: Column[], rows: Row[]): Array<Row> {
    let numRows = 0;
    let numChars = 0;

    for (const row of rows) {
      for (const col of columns) {
        if (typeof row[col] === 'string') {
          numChars += row[col].length;
        } else {
          numChars += 3; // estimated for other fields
        }
      }

      numRows++;

      if (numChars > Datastore.MAX_CHARACTERS) break;
      if (numRows > Datastore.MAX_ROW) break;
    }

    return rows.slice(0, numRows);
  }

  protected sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  protected getTableName(name: string, number: number | null = null): string {
    return this.getUniqueTableName(this.sanitizeName(name), number);
  }

  protected getUniqueTableName(base: string, number: number | null = null): string {
    const candidate = base + (number ? `_${number}` : '');
    for (const table of this.tables) {
      if (candidate === table) {
        return this.getUniqueTableName(base, (number || 0) + 1);
      }
    }
    return candidate;
  }

  protected makeQueryTableName(): string {
    return this.getTableName('query', 1);
  }
}
