import React from 'react'
import { type Result, DraftSql, Sheet, generateWorkspaceItemId, DraftResult, type PresentationType, type ChartOptions, type SheetEditorState, DraftSheetName } from './types'
import { drop } from '../api'
import { type ExportedWorkflow } from '../../types'

export interface ObjectWrapper<T> {
  base: T
}

export interface WorkspaceState {
  draftSqls: Array<ObjectWrapper<DraftSql>>
  results: Array<ObjectWrapper<Result>>
  selectedComposableItemId: string | null
  selectedResultId: string | null
}

export enum ActionType {
  MAKE_DRAFT_SQL = 'make_draft_sql',
  ADD_OR_REPLACE_RESULT = 'add_or_replace_result',
  TOGGLE_LOADING = 'toggle_loading',
  RENAME = 'rename',
  DELETE_DRAFT_SQL = 'delete_draft_sql',
  DELETE_RESULT = 'delete_result',
  SET_COMPOSABLE_ITEM_ID = 'set_composable_item_id',
  SET_RESULT_ID = 'set_result_id',
  DISCARD_DRAFT_SQL = 'discard_draft_sql',
  SET_PRESENTATION_TYPE = 'set_presentation_type',
  SET_CHART_OPTIONS = 'set_chart_options',
  SET_EDITOR_STATE = 'set_editor_state'
}

export interface Action {
  type: ActionType
  id?: string | null
  newName?: string
  newResult?: Result | null
  loading?: boolean
  targetDraftResult?: boolean
  sql?: string
  presentationType?: PresentationType
  chartOptions?: ChartOptions | null
  editorState?: SheetEditorState | null
}

function update (state: WorkspaceState, resultIndex: number | null = null): WorkspaceState {
  if (resultIndex !== null && resultIndex >= 0 && resultIndex < state.results.length) {
    state.results[resultIndex] = { ...state.results[resultIndex] }
  }

  state.results = [...state.results]
  return { ...state }
}

let draftSqlNumberRunner = 1
export function reduce (state: WorkspaceState, action: Action): WorkspaceState {
  if (action.type === ActionType.RENAME) {
    const index = state.results.findIndex((i) => i.base.id === action.id)!

    state.results[index].base.name = action.newName!
    return update(state, index)
  } else if (action.type === ActionType.DELETE_DRAFT_SQL) {
    const id = action.id!
    state.draftSqls = state.draftSqls.filter((i) => i.base.id !== id)

    if (id === state.selectedComposableItemId) {
      state.selectedComposableItemId = null
    }

    return { ...state }
  } else if (action.type === ActionType.DELETE_RESULT) {
    const id = action.id!
    const result = state.results.find((i) => i.base.id === id)

    if (result) {
      const confirmMsg = `Are you sure you want to remove: ${result.base.name}?`
      if (!confirm(confirmMsg)) {
        return state
      }

      void drop(result.base.name)
    }

    state.results = state.results.filter((i) => i.base.id !== id)

    if (id === state.selectedComposableItemId) {
      state.selectedComposableItemId = null
    }
    if (id === state.selectedResultId) {
      state.selectedResultId = null
    }

    return { ...state }
  } else if (action.type === ActionType.MAKE_DRAFT_SQL) {
    const draftSql: DraftSql = new DraftSql({
      id: generateWorkspaceItemId(),
      name: action.newName ?? `draft-${draftSqlNumberRunner++}`,
      sql: action.sql!,
      isCsv: false
    })

    state.draftSqls = [...state.draftSqls, { base: draftSql }]
    return {
      ...state,
      selectedComposableItemId: draftSql.id
    }
  } else if (action.type === ActionType.ADD_OR_REPLACE_RESULT) {
    const newResult = action.newResult!
    const foundIndex = state.results.findIndex((s) => s.base.id === newResult.id)

    if (foundIndex > -1) {
      state.results.splice(foundIndex, 1)
    }
    state.results.push({ base: newResult })

    return update(state)
  } else if (action.type === ActionType.TOGGLE_LOADING) {
    let index: number

    if (action.targetDraftResult) {
      index = state.results.findIndex((i) => i.base instanceof DraftResult)
    } else {
      index = state.results.findIndex((i) => i.base.id === action.id!)
    }

    if (index > -1) {
      state.results[index].base.isLoading = action.loading!
    }

    return update(state, index)
  } else if (action.type === ActionType.SET_COMPOSABLE_ITEM_ID) {
    state.selectedComposableItemId = action.id ?? null
    return { ...state }
  } else if (action.type === ActionType.SET_RESULT_ID) {
    state.selectedResultId = action.id ?? null
    return { ...state }
  } else if (action.type === ActionType.DISCARD_DRAFT_SQL) {
    state.draftSqls = state.draftSqls.filter((i) => i.base.id !== action.id!)
    return { ...state }
  } else if (action.type === ActionType.SET_PRESENTATION_TYPE) {
    const presentationType = action.presentationType!
    const index = state.results.findIndex((i) => i.base.id === action.id!)

    if (index > -1) {
      state.results[index].base.presentationType = presentationType
    }

    return update(state, index)
  } else if (action.type === ActionType.SET_CHART_OPTIONS) {
    const chartOptions = action.chartOptions ?? null
    const index = state.results.findIndex((i) => i.base.id === action.id!)

    if (index > -1) {
      state.results[index].base.chartOptions = chartOptions
    }

    return update(state, index)
  } else if (action.type === ActionType.SET_EDITOR_STATE) {
    const editorState = action.editorState ?? null
    const resultIndex = state.results.findIndex((i) => i.base.id === action.id!)

    if (resultIndex > -1) {
      state.results[resultIndex].base.editorState = editorState
      return update(state, resultIndex)
    }

    const draftSqlIndex = state.draftSqls.findIndex((i) => i.base.id === action.id!)

    if (draftSqlIndex > -1) {
      state.draftSqls[draftSqlIndex].base.editorState = editorState
      state.draftSqls[draftSqlIndex] = { ...state.draftSqls[draftSqlIndex] }
      state.draftSqls = [...state.draftSqls]
      return { ...state }
    }

    return state
  }

  return state
}

export const WorkspaceContext = React.createContext<WorkspaceState>({ draftSqls: [], results: [], selectedComposableItemId: null, selectedResultId: null })
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

  public deleteDraftSql (id: string): void {
    this.dispatch({
      type: ActionType.DELETE_DRAFT_SQL,
      id
    })
  }

  public deleteResult (id: string): void {
    this.dispatch({
      type: ActionType.DELETE_RESULT,
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
    workflow.results.forEach((result) => {
      let newResult: Result

      if (result.name === DraftSheetName) {
        newResult = new DraftResult({
          count: 0,
          columns: [],
          rows: [],
          ...result,
          id: generateWorkspaceItemId()
        })
      } else {
        newResult = new Sheet({
          count: 0,
          columns: [],
          rows: [],
          ...result,
          id: generateWorkspaceItemId()
        })
      }

      this.dispatch({
        type: ActionType.ADD_OR_REPLACE_RESULT,
        newResult
      })
    })

    workflow.draftSqls.forEach((draftSql) => {
      this.dispatch({
        type: ActionType.MAKE_DRAFT_SQL,
        newName: draftSql.name,
        sql: draftSql.draft ?? draftSql.sql
      })
    })
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

  public setEditorState (id: string, editorState: SheetEditorState | null): void {
    this.dispatch({ type: ActionType.SET_EDITOR_STATE, id, editorState })
  }
}
