import { type QueryResult, type ColumnType, type Sort } from '../../types'

export const DraftSheetName = '_T_DRAFT_T_'

export type RunSqlMode = 'default' | 'partial-new' | 'partial-draft'

export const PresentationTypes = ['table', 'chart'] as const
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

let workspaceItemIdRunner = 1
export function generateWorkspaceItemId (): string {
  return `item-${workspaceItemIdRunner++}`
}

export interface WorkspaceItemProps {
  id: string
  name: string
  previousName?: string | null
  sql: string
  editorState?: SheetEditorState | null
  isLoading?: boolean
}

export abstract class WorkspaceItem {
  id: string
  name: string
  previousName: string | null
  sql: string
  editorState: SheetEditorState | null
  isLoading: boolean

  constructor (options: WorkspaceItemProps) {
    this.id = options.id
    this.name = options.name
    this.previousName = options.previousName ?? null
    this.sql = options.sql
    this.editorState = options.editorState ?? null
    this.isLoading = options.isLoading ?? false
  }

  abstract getIsCsv (): boolean
  abstract getRank (): number
  abstract isComposable (): boolean
}

export class DraftSql extends WorkspaceItem {
  getIsCsv (): boolean {
    return false
  }

  getRank (): number {
    return 0
  }

  isComposable (): boolean {
    return true
  }
}

export type ChartType = 'line' | 'bar' | 'stacked_bar' | 'pie'
export const LabelTimestampFormats = ['hour', 'day', 'month', 'year'] as const
export type LabelTimestampFormat = typeof LabelTimestampFormats[number]

export interface ChartOptions {
  type: ChartType
  labelColumnIndex: number | null
  labelColumnTimestampFormat: LabelTimestampFormat
  datasetColumnIndices: Array<number | null>
  minDatasetRange: number | null
  maxDatasetRange: number | null
}

export type ResultProps = WorkspaceItemProps & {
  isCsv: boolean
  count: number
  columns: Column[]
  rows: string[][]
  presentationType: PresentationType
  scrollLeft?: number | null
  scrollTop?: number | null
  resizedColumns?: Record<number, number> | null
  sorts?: Sort[]
  selection?: Selection | null
  userSelect?: UserSelectTarget | null
  chartOptions?: ChartOptions | null
}

export abstract class Result extends WorkspaceItem {
  isCsv: boolean
  count: number
  columns: Column[]
  rows: any[][]
  presentationType: PresentationType
  scrollLeft: number | null
  scrollTop: number | null
  resizedColumns: Record<number, number>
  sorts: Sort[]
  selection: Selection | null
  userSelect: UserSelectTarget | null
  chartOptions: ChartOptions | null

  constructor (
    options: ResultProps
  ) {
    super(options)

    this.isCsv = options.isCsv
    this.count = options.count
    this.columns = options.columns
    this.rows = options.rows
    this.presentationType = options.presentationType
    this.scrollLeft = options.scrollLeft ?? null
    this.scrollTop = options.scrollTop ?? null
    this.resizedColumns = options.resizedColumns ?? {}
    this.sorts = options.sorts ?? []
    this.selection = options.selection ?? null
    this.userSelect = options.userSelect ?? null
    this.chartOptions = options.chartOptions ?? null
  }

  getIsCsv (): boolean {
    return this.isCsv
  }

  getRank (): number {
    return this.isCsv ? 1 : 2
  }

  update (queryResult: QueryResult, preserveOriginalSql: boolean): void {
    if (!preserveOriginalSql) {
      this.sql = queryResult.sql
    }

    this.columns = queryResult.columns
    this.rows = queryResult.rows
    this.count = queryResult.count
    this.sorts = []
  }

  updateSorts (newSorts: Sort[]): void {
    this.sorts = newSorts
  }
}

export class DraftResult extends Result {
  constructor (options: ResultProps) {
    if (options.name !== DraftSheetName) {
      throw new Error(`DraftResult's name must be ${DraftSheetName}`)
    }
    if (options.isCsv) {
      throw new Error('DraftResult\'s isCsv must be false')
    }
    super(options)
  }

  isComposable (): boolean {
    return false
  }
}

export class Sheet extends Result {
  isComposable (): boolean {
    return true
  }
}

export interface Selection {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}
