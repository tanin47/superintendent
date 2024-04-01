import React from 'react'
import { Result, type WorkspaceItem, DraftSql, Sheet, generateWorkspaceItemId, DraftResult } from './types'
import { drop } from '../api'
import { type ExportedWorkflow } from '../../types'

export interface WorkspaceState {
  items: WorkspaceItem[]
  selectedComposableItem: WorkspaceItem | null
  selectedResult: Result | null
}

export enum ActionType {
  MAKE_DRAFT_SQL = 'make_draft_sql',
  ADD_OR_REPLACE_RESULT = 'add_or_replace_result',
  TOGGLE_LOADING = 'toggle_loading',
  RENAME = 'rename',
  DELETE = 'delete',
  SET_COMPOSABLE_ITEM = 'set_composable_item',
  SET_RESULT = 'set_result',
  IMPORT_WORKFLOW = 'import_workflow',
  DISCARD_DRAFT_SQL = 'discard_draft_sql'
}

export interface Action {
  type: ActionType
  item?: WorkspaceItem
  newName?: string
  result?: Result | null
  shouldSwitchEditor?: boolean
  loading?: boolean
  targetDraftResult?: boolean
  composableItem?: WorkspaceItem | null
  workflow?: ExportedWorkflow
  draftSql?: DraftSql
  sql?: string
}

let draftSqlNumberRunner = 1
export function reduce (state: WorkspaceState, action: Action): WorkspaceState {
  if (action.type === ActionType.RENAME) {
    state.items = state.items.map((item) => {
      if (item === action.item!) {
        item.previousName = item.name
        item.name = action.newName!
      }
      return item
    })
    return { ...state }
  } else if (action.type === ActionType.DELETE) {
    const item = action.item!
    if (!(item instanceof DraftSql)) {
      const confirmMsg = `Are you sure you want to remove: ${item.name}?`
      if (!confirm(confirmMsg)) {
        return state
      }

      void drop(item.name)
    }

    state.items = state.items.filter((i) => i !== item)

    if (item === state.selectedComposableItem) {
      state.selectedComposableItem = null
    }

    return { ...state }
  } else if (action.type === ActionType.MAKE_DRAFT_SQL) {
    const item: DraftSql = new DraftSql({
      id: generateWorkspaceItemId(),
      name: `draft-${draftSqlNumberRunner++}`,
      sql: action.sql!
    })

    if (state.items.length === 0) {
      state.selectedComposableItem = item
    }

    state.items = [...state.items, item]
    return {
      ...state,
      selectedComposableItem: item
    }
  } else if (action.type === ActionType.ADD_OR_REPLACE_RESULT) {
    const newResult = action.result!
    const foundIndex = state.items.findIndex((s) => s.id === newResult.id)
    const found = foundIndex > -1 ? state.items[foundIndex] : null

    if (found && !(found instanceof DraftSql)) {
      if (found !== newResult) {
        throw new Error('They should have been the same object')
      }
      // state.items.splice(foundIndex, 1, newResult)
      // setTimeout(() => { resultSectionRef.current!.open(newResult.name) }, 1)
      // TODO: replace selectedComposableItem
    } else {
      if (found && found instanceof DraftSql) {
        state.items.splice(foundIndex, 1)
      }

      state.items.push(newResult)

      if (!newResult.isCsv && action.shouldSwitchEditor) {
        state.selectedComposableItem = newResult as Sheet
      }
    }

    state.items = [...state.items]
    return { ...state }
  } else if (action.type === ActionType.TOGGLE_LOADING) {
    let targetItem: Result

    if (action.targetDraftResult) {
      targetItem = state.items.find((i) => i instanceof DraftResult)! as Result
    } else {
      targetItem = action.result!
    }

    for (const item of state.items) {
      if (item === targetItem) {
        item.isLoading = action.loading!
      }
    }

    state.items = [...state.items]
    return { ...state }
  } else if (action.type === ActionType.SET_COMPOSABLE_ITEM) {
    state.selectedComposableItem = action.composableItem ?? null
    return { ...state }
  } else if (action.type === ActionType.SET_RESULT) {
    state.selectedResult = action.result ?? null
    return { ...state }
  } else if (action.type === ActionType.IMPORT_WORKFLOW) {
    state.items = [
      ...state.items,
      ...action.workflow!.sheets.map((sheet) => new Sheet({
        id: generateWorkspaceItemId(),
        name: sheet.name,
        isCsv: sheet.isCsv,
        sql: sheet.sql,
        count: 0,
        columns: [],
        rows: [],
        sorts: [],
        presentationType: 'table'
      }))
    ]
    return { ...state }
  } else if (action.type === ActionType.DISCARD_DRAFT_SQL) {
    const draftSql = action.draftSql!

    state.items = state.items.filter((i) => i.id !== draftSql.id)
    return { ...state }
  }

  return state
}

export const WorkspaceContext = React.createContext<WorkspaceState>({ items: [], selectedComposableItem: null, selectedResult: null })
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

  public startLoading (item: WorkspaceItem | null): void {
    if (item && item instanceof Result) {
      this.dispatch({ type: ActionType.TOGGLE_LOADING, result: item, loading: true })
    }
  }

  public stopLoading (item: WorkspaceItem | null): void {
    if (item && item instanceof Result) {
      this.dispatch({ type: ActionType.TOGGLE_LOADING, result: item, loading: false })
    }
  }

  public addOrReplaceResult (result: Result, shouldSwitchEditor: boolean): void {
    this.dispatch({ type: ActionType.ADD_OR_REPLACE_RESULT, result, shouldSwitchEditor })
  }

  public setSelectedComposableItem (item: WorkspaceItem | null): void {
    this.dispatch({ type: ActionType.SET_COMPOSABLE_ITEM, composableItem: item })
  }

  public setSelectedResult (result: Result | null): void {
    this.dispatch({ type: ActionType.SET_RESULT, result })
  }

  public deleteComposableItem (item: WorkspaceItem): void {
    this.dispatch({
      type: ActionType.DELETE,
      item
    })
  }

  public rename (item: WorkspaceItem, newName: string): void {
    this.dispatch({
      type: ActionType.RENAME,
      item,
      newName
    })
  }

  public importWorkflow (workflow: ExportedWorkflow): void {
    this.dispatch({ type: ActionType.IMPORT_WORKFLOW, workflow })
  }

  public discardDraftSql (draftSql: DraftSql): void {
    this.dispatch({ type: ActionType.DISCARD_DRAFT_SQL, draftSql })
  }
}
