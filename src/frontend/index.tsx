import React, { ReactElement } from 'react';
import './index.scss';
import Workspace from './Workspace';
import CheckLicense from './CheckLicense';
import {ipcRenderer} from "electron";

const initialState: PageState = {page: 'check-license', evaluationMode: true};

type Page = 'check-license' | 'workspace';

type PageState = {
  page: Page,
  evaluationMode: boolean
}

type Action = {
  changeTo: Page,
  setEvaluationMode?: boolean
}

function reducer(state: PageState, action: Action): PageState {
  const optionals: {evaluationMode?: boolean} = {};

  if (action.setEvaluationMode !== undefined) {
    optionals.evaluationMode = action.setEvaluationMode;

    ipcRenderer.invoke('set-evaluation-mode', action.setEvaluationMode);
  }
  return {...state, page: action.changeTo, ...optionals}
}

export default function App(): ReactElement {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  switch (state.page) {
    case 'check-license':
      return <CheckLicense onFinished={(evaluationMode) => dispatch({changeTo: 'workspace', setEvaluationMode: evaluationMode})} />
    case 'workspace':
      return <Workspace evaluationMode={state.evaluationMode} />
  }

  throw new Error();
}
