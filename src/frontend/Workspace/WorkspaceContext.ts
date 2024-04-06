import React from 'react'
import { Result, type WorkspaceItem, DraftSql, Sheet, generateWorkspaceItemId, DraftResult, type PresentationType, type ChartOptions } from './types'
import { drop } from '../api'
import { type ExportedWorkflow } from '../../types'

export interface WorkspaceItemWrapper {
  base: WorkspaceItem
}

export interface WorkspaceState {
  items: WorkspaceItemWrapper[]
  selectedComposableItemId: string | null
  selectedResultId: string | null
}

export enum ActionType {
  MAKE_DRAFT_SQL = 'make_draft_sql',
  ADD_OR_REPLACE_RESULT = 'add_or_replace_result',
  TOGGLE_LOADING = 'toggle_loading',
  RENAME = 'rename',
  DELETE = 'delete',
  SET_COMPOSABLE_ITEM_ID = 'set_composable_item_id',
  SET_RESULT_ID = 'set_result_id',
  IMPORT_WORKFLOW = 'import_workflow',
  DISCARD_DRAFT_SQL = 'discard_draft_sql',
  SET_PRESENTATION_TYPE = 'set_presentation_type',
  SET_CHART_OPTIONS = 'set_chart_options'
}

export interface Action {
  type: ActionType
  id?: string | null
  newName?: string
  newResult?: Result | null
  loading?: boolean
  targetDraftResult?: boolean
  workflow?: ExportedWorkflow
  sql?: string
  presentationType?: PresentationType
  chartOptions?: ChartOptions | null
}

function update (state: WorkspaceState, index: number | null = null): WorkspaceState {
  if (index !== null && index >= 0 && index < state.items.length) {
    state.items[index] = { ...state.items[index] }
  }

  state.items = [...state.items]
  return { ...state }
}

let draftSqlNumberRunner = 1
export function reduce (state: WorkspaceState, action: Action): WorkspaceState {
  if (action.type === ActionType.RENAME) {
    const index = state.items.findIndex((i) => i.base.id === action.id)!

    state.items[index].base.name = action.newName!
    return update(state, index)
  } else if (action.type === ActionType.DELETE) {
    const id = action.id!
    const item = state.items.find((i) => i.base.id === id)

    if (item && !(item.base instanceof DraftSql)) {
      const confirmMsg = `Are you sure you want to remove: ${item.base.name}?`
      if (!confirm(confirmMsg)) {
        return state
      }

      void drop(item.base.name)
    }

    state.items = state.items.filter((i) => i.base.id !== item?.base.id)

    if (id === state.selectedComposableItemId) {
      state.selectedComposableItemId = null
    }
    if (id === state.selectedResultId) {
      state.selectedResultId = null
    }

    return { ...state }
  } else if (action.type === ActionType.MAKE_DRAFT_SQL) {
    const item: DraftSql = new DraftSql({
      id: generateWorkspaceItemId(),
      name: `draft-${draftSqlNumberRunner++}`,
      sql: action.sql!
    })

    if (state.items.length === 0) {
      state.selectedComposableItemId = item.id
    }

    state.items = [...state.items, { base: item }]
    return {
      ...state,
      selectedComposableItemId: item.id
    }
  } else if (action.type === ActionType.ADD_OR_REPLACE_RESULT) {
    const newResult = action.newResult!
    const foundIndex = state.items.findIndex((s) => s.base.id === newResult.id)

    if (foundIndex > -1) {
      state.items.splice(foundIndex, 1)
    }
    state.items.push({ base: newResult })

    return update(state)
  } else if (action.type === ActionType.TOGGLE_LOADING) {
    let index: number

    if (action.targetDraftResult) {
      index = state.items.findIndex((i) => i.base instanceof DraftResult)
    } else {
      index = state.items.findIndex((i) => i.base.id === action.id!)
    }

    if (index > -1) {
      state.items[index].base.isLoading = action.loading!
    }

    return update(state, index)
  } else if (action.type === ActionType.SET_COMPOSABLE_ITEM_ID) {
    state.selectedComposableItemId = action.id ?? null
    return { ...state }
  } else if (action.type === ActionType.SET_RESULT_ID) {
    state.selectedResultId = action.id ?? null
    return { ...state }
  } else if (action.type === ActionType.IMPORT_WORKFLOW) {
    state.items = [
      ...state.items,
      ...action.workflow!.sheets.map((sheet) => ({
        base: new Sheet({
          id: generateWorkspaceItemId(),
          name: sheet.name,
          isCsv: sheet.isCsv,
          sql: sheet.sql,
          count: 0,
          columns: [],
          rows: [],
          sorts: [],
          presentationType: 'table'
        })
      }))
    ]
    return { ...state }
  } else if (action.type === ActionType.DISCARD_DRAFT_SQL) {
    state.items = state.items.filter((i) => i.base.id !== action.id!)
    return { ...state }
  } else if (action.type === ActionType.SET_PRESENTATION_TYPE) {
    const presentationType = action.presentationType!
    const index = state.items.findIndex((i) => i.base.id === action.id!)

    if (index > -1) {
      const base = state.items[index].base

      if (base instanceof Result) {
        base.presentationType = presentationType
      }
    }

    return update(state, index)
  } else if (action.type === ActionType.SET_CHART_OPTIONS) {
    const chartOptions = action.chartOptions!
    const index = state.items.findIndex((i) => i.base.id === action.id!)

    if (index > -1) {
      const base = state.items[index].base

      if (base instanceof Result) {
        base.chartOptions = chartOptions
      }
    }

    return update(state, index)
  }

  return state
}

export const WorkspaceContext = React.createContext<WorkspaceState>({ items: [], selectedComposableItemId: null, selectedResultId: null })
export const DispatchContext = React.createContext<React.Dispatch<Action> | null>(null)

export function useWorkspaceContext (): WorkspaceState {
  return React.useContext(WorkspaceContext)
}

export function useDispatch (): React.Dispatch<Action> {
  return React.useContext(DispatchContext)!
}

export class StateChangeApi {
  dispatch: React.Dispatch<Action>

  constructor (dispatch: React.Dispatch<Action>) {
    this.dispatch = dispatch
  }

  public makeDraftSql (sql: string): void {
    this.dispatch({ type: ActionType.MAKE_DRAFT_SQL, sql })
  }

  public startLoadingDraftResult (): void {
    this.dispatch({ type: ActionType.TOGGLE_LOADING, loading: true, targetDraftResult: true })
  }

  public stopLoadingDraftResult (): void {
    this.dispatch({ type: ActionType.TOGGLE_LOADING, loading: false, targetDraftResult: true })
  }

  public startLoading (id: string | null): void {
    this.dispatch({ type: ActionType.TOGGLE_LOADING, id, loading: true })
  }

  public stopLoading (id: string | null): void {
    this.dispatch({ type: ActionType.TOGGLE_LOADING, id, loading: false })
  }

  public addOrReplaceResult (newResult: Result): void {
    this.dispatch({ type: ActionType.ADD_OR_REPLACE_RESULT, newResult })
  }

  public setSelectedComposableItemId (id: string | null): void {
    this.dispatch({ type: ActionType.SET_COMPOSABLE_ITEM_ID, id })
  }

  public setSelectedResultId (id: string | null): void {
    this.dispatch({ type: ActionType.SET_RESULT_ID, id })
  }

  public deleteComposableItemId (id: string): void {
    this.dispatch({
      type: ActionType.DELETE,
      id
    })
  }

  public rename (id: string, newName: string): void {
    this.dispatch({
      type: ActionType.RENAME,
      id,
      newName
    })
  }

  public importWorkflow (workflow: ExportedWorkflow): void {
    this.dispatch({ type: ActionType.IMPORT_WORKFLOW, workflow })
  }

  public discardDraftSql (id: string): void {
    this.dispatch({ type: ActionType.DISCARD_DRAFT_SQL, id })
  }

  public setPresentationType (id: string, presentationType: PresentationType): void {
    this.dispatch({ type: ActionType.SET_PRESENTATION_TYPE, id, presentationType })
  }

  public setChartOptions (id: string, chartOptions: ChartOptions | null): void {
    this.dispatch({ type: ActionType.SET_CHART_OPTIONS, id, chartOptions })
  }
}
