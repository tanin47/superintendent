import React, { type ReactElement } from 'react'
import './index.scss'
import Workspace from './Workspace'
import CheckLicense from './CheckLicense'
import { trackEvent } from '@aptabase/electron/renderer'

if (window.miscApi.isWdioEnabled()) {
  // @ts-expect-error for testing
  // eslint-disable-next-line no-global-assign
  confirm = () => { return true }
}

type Page = 'license' | 'workspace'

export default function App (): ReactElement {
  const [page, setPage] = React.useState<Page>('workspace')

  React.useEffect(
    () => {
      void trackEvent('app_opened')
    },
    []
  )

  switch (page) {
    case 'license':
      return <CheckLicense onGoToWorkspace={() => { setPage('workspace') }} />
    case 'workspace':
      return <Workspace onGoToLicense={() => { setPage('license') }}/>
  }
}
