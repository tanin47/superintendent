import {XYPosition} from "@reactflow/core/dist/esm/types";

export const PresentationTypes = ['table', 'line', 'pie', 'bar'] as const;
export type PresentationType = typeof PresentationTypes[number];

export type Column = {
  name: string,
  maxCharWidthCount: number
}

export type UserSelectTarget = {
  rowIndex: number,
  colIndex: number,
};

export type SheetEditorState = {
  draft?: string | null,
  cursor?: any | null,
  selections?: any | null,
};

export type Sheet = {
  name: string,
  previousName?: string | null,
  isCsv: boolean,
  dependsOn: string[],
  sql: string,
  count: number,
  columns: Column[],
  rows: string[][],
  presentationType: PresentationType,
  scrollLeft: number | null,
  scrollTop: number | null,
  resizedColumns: {[col:number]: number},
  selection: Selection | null,
  userSelect: UserSelectTarget | null,
  editorState: SheetEditorState | null,
};

export type Selection = {
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
};
