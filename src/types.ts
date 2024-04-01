export type EditorMode = 'default' | 'vim'

export type Format = 'comma' | 'tab' | 'pipe' | 'semicolon' | 'colon' | 'tilde' | 'super'

export const ExportDelimiters = ['comma', 'tab', 'pipe', 'semicolon', 'colon', 'tilde'] as const
export type ExportDelimiter = typeof ExportDelimiters[number]
export const ExportWorkflowChannel = 'export-workflow'
export const ImportWorkflowChannel = 'import-workflow'

export const EditorModeChannel = 'editor-mode-changed'

export type SortDirection = 'asc' | 'desc' | 'none'
export interface Sort { name: string, direction: SortDirection }

export const ColumnTypes = ['varchar', 'double', 'bigint', 'timestamp', 'boolean']
export type ColumnType = typeof ColumnTypes[number]

export interface CopySelection {
  columns: string[]
  startRow: number
  endRow: number
  includeRowNumbers: boolean
  includeColumnNames: boolean
}

export interface WorkflowSheet {
  name: string
  sql: string
  isCsv: boolean
}

export interface ExportedWorkflow {
  sheets: WorkflowSheet[]
}

export interface QueryColumn {
  name: string
  maxCharWidthCount: number
  tpe: ColumnType
}
export type QueryRow = string[]

export interface QueryResult {
  name: string
  sql: string
  columns: QueryColumn[]
  rows: QueryRow[]
  count: number
}
