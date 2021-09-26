
export type PresentationType = 'table' | 'line' | 'bar' | 'pie';

export type Column = {
  name: string,
  maxCharWidthCount: number
}

export type Sheet = {
  name: string,
  sql: string,
  count: number,
  columns: Column[],
  rows: string[][],
  presentationType: PresentationType,
  scrollLeft: number | null,
  scrollTop: number | null
};
