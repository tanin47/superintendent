export type EditorMode = 'default' | 'vim'

export const DatabaseEngines = ['sqlite', 'duckdb'] as const
export type DatabaseEngine = typeof DatabaseEngines[number]

export type Format = 'comma' | 'tab' | 'pipe' | 'semicolon' | 'colon' | 'tilde' | 'super'

export const ExportDelimiters = ['comma', 'tab', 'pipe', 'semicolon', 'colon', 'tilde'] as const
export type ExportDelimiter = typeof ExportDelimiters[number]
export const ExportWorkflowChannel = 'export-workflow'
export const ImportWorkflowChannel = 'import-workflow'

export const EditorModeChannel = 'editor-mode-changed'
export const DatabaseEngineChannel = 'database-engine-changed'

export type SortDirection = 'asc' | 'desc' | 'none'
export interface Sort { name: string, direction: SortDirection }

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
