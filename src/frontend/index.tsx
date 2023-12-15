import React, {ReactElement} from 'react';
import './index.scss';
import Workspace from './Workspace';
import CheckLicense from './CheckLicense';

if (window.miscApi.isWdioEnabled()) {
  // @ts-ignore
  confirm = () => { return true; };
}

type Page = 'check-license' | 'workspace';

type PageState = {
  page: Page,
}

type Action = {
  changeTo: Page,
}

const initialState: PageState = {page: 'check-license'};

function reducer(state: PageState, action: Action): PageState {
  return {...state, page: action.changeTo}
}

export default function App(): ReactElement {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  switch (state.page) {
    case 'check-license':
      return <CheckLicense onFinished={() => dispatch({changeTo: 'workspace'})} />
    case 'workspace':
      return <Workspace />
  }

  throw new Error();
}
