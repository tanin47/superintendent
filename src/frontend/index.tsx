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

  return (
    <>
      <div style={{ display: page === 'license' ? 'block' : 'none' }}>
        <CheckLicense onGoToWorkspace={() => { setPage('workspace') }} />
      </div>
      <div style={{ display: page === 'workspace' ? 'block' : 'none' }}>
        <Workspace onGoToLicense={() => { setPage('license') }}/>
      </div>
    </>
  )
}
