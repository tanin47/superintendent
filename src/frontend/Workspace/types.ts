
export type EditorMode = 'default' | 'vim';

export type PresentationType = 'table' | 'line' | 'bar' | 'pie';

export type Sheet = {
  name: string,
  sql: string,
  count: number,
  columns: string[],
  rows: string[][],
  presentationType: PresentationType
};
