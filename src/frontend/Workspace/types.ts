import { type ColumnType, type Sort } from '../../types'

export const PresentationTypes = ['table', 'line', 'pie', 'bar'] as const
export type PresentationType = typeof PresentationTypes[number]

export interface Column {
  name: string
  maxCharWidthCount: number
  tpe: ColumnType
}

export interface UserSelectTarget {
  rowIndex: number
  colIndex: number
}

export interface SheetEditorState {
  draft?: string | null
  cursor?: any | null
  selections?: any | null
}

export interface Sheet {
  name: string
  previousName?: string | null
  isCsv: boolean
  sql: string
  count: number
  columns: Column[]
  rows: string[][]
  presentationType: PresentationType
  scrollLeft: number | null
  scrollTop: number | null
  resizedColumns: Record<number, number>
  sorts: Sort[]
  selection: Selection | null
  userSelect: UserSelectTarget | null
  editorState: SheetEditorState | null
  isLoading: boolean
}

export interface Selection {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}
