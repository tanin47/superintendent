import { type ChartOptions, type PresentationType } from './frontend/Workspace/types'
import { type ExclusiveEventHintOrCaptureContext } from '@sentry/core/types/utils/prepareEvent'

export type EditorMode = 'default' | 'vim'

export type Format = 'comma' | 'tab' | 'pipe' | 'semicolon' | 'colon' | 'tilde' | 'super'

export const ExportDelimiters = ['comma', 'tab', 'pipe', 'semicolon', 'colon', 'tilde'] as const
export type ExportDelimiter = typeof ExportDelimiters[number]
export const ShowErrorDialogChannel = 'show-error-dialog'
export const ExportWorkflowChannel = 'export-workflow'
export const ImportWorkflowChannel = 'import-workflow'
export const StartImportingWorkflowChannel = 'start-importing-workflow'

export const EditorModeChannel = 'editor-mode-changed'
export const GoToPurchaseLicense = 'go-to-purchase-license'

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

export interface WorkflowResult {
  name: string
  sql: string
  sorts: Sort[]
  isCsv: boolean
  draft: string | null
  presentationType: PresentationType
  chartOptions: ChartOptions | null
}

export interface WorkflowDraftSql {
  name: string
  sql: string
  draft: string | null
}

export interface ExportedWorkflow {
  results: WorkflowResult[]
  draftSqls: WorkflowDraftSql[]
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

export interface ExportWorkflowResponse {
  file: string
}

export interface ErrorContext {
  action: string
  extras?: Record<string, string> | null
}

export type TrackEventFunction = (eventName: string, props?: Record<string, string | number | boolean>) => Promise<void>
export type CaptureExceptionFunction = (exception: any, hint?: ExclusiveEventHintOrCaptureContext) => string

export interface SentryFunctions {
  init: (options: { dsn: string, maxValueLength: number }) => void
  captureException: CaptureExceptionFunction
}

export interface AptabaseFunctions {
  initialize: (appKey: string) => Promise<void>
  trackEvent: TrackEventFunction
}
