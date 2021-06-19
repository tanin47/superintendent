
export type EditorMode = 'default' | 'vim';

export type PresentationType = 'table' | 'line' | 'bar' | 'pie';

export type Sheet = {
  name: string,
  count: number,
  hasMore: boolean,
  columns: Array<string>,
  rows: Array<{[key:string]: any}>,
  presentationType: PresentationType
};
