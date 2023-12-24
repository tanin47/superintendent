import React, { type ReactElement } from 'react'
import './index.scss'
import Workspace from './Workspace'
import CheckLicense from './CheckLicense'

if (window.miscApi.isWdioEnabled()) {
  // @ts-expect-error for testing
  // eslint-disable-next-line no-global-assign
  confirm = () => { return true }
}

type Page = 'check-license' | 'workspace'

interface PageState {
  page: Page
}

interface Action {
  changeTo: Page
}

const initialState: PageState = { page: 'check-license' }

function reducer (state: PageState, action: Action): PageState {
  return { ...state, page: action.changeTo }
}

export default function App (): ReactElement {
  const [state, dispatch] = React.useReducer(reducer, initialState)

  switch (state.page) {
    case 'check-license':
      return <CheckLicense onFinished={() => { dispatch({ changeTo: 'workspace' }) }} />
    case 'workspace':
      return <Workspace />
  }

  throw new Error()
}
