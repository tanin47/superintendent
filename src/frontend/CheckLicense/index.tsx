import React, { type ReactElement } from 'react'
import './index.scss'
import { checkIfLicenseIsValid, hasValidLicense } from '../api'
import { DateTime } from 'luxon'

export default function CheckLicenseForm ({
  onGoToWorkspace
}: {
  onGoToWorkspace: () => void
}): ReactElement {
  const [licenseKey, setLicenseKey] = React.useState('')
  const [isLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const placeholder = React.useMemo(() => [
    '---- Superintendent license ----',
    'Name: Tanin Na Nakorn',
    'Email: support@superintendent.app',
    'Key0: SomeKey0',
    'Key1:',
    'SomeKeyLine1',
    'SomeKeyLine2',
    '---- End of Superintendent license ----'
  ].join('\n'), [])

  const licenseValidity = hasValidLicense(true)

  return (
    <div id="checkLicenseForm">
      <div className="enter-license-form">
        <div className="label">
          <span className="step">1</span>
          Go to <span className="link" onClick={() => { window.shellApi.openExternal('https://superintendent.app') }}>https://superintendent.app</span> to purchase a license key
        </div>
        <div className="label">
          <span className="step">2</span>
          Check your email for the license key
        </div>
        <div className="label">
          <span className="step">3</span>
          Enter the license key below:
        </div>
        <div className="field">
          <div className="input">
            <textarea
              disabled={isLoading}
              value={licenseKey}
              onChange={(event) => { setLicenseKey(event.target.value) }}
              placeholder={placeholder}
            />
          </div>
        </div>
        <div className="cta">
          {licenseValidity.state === 'valid' && (
            <div className="valid-license">
              You do not need to buy another license. You currently have a license that will expire on {licenseValidity.expiredAt ? DateTime.fromJSDate(licenseValidity.expiredAt).toLocaleString(DateTime.DATE_MED) : '[unknown]'}.
            </div>
          )}
          {errorMessage != null && (
            <div className="error-message">{errorMessage}</div>
          )}
          <div className="button-panel">
            <button
              data-testid="submit-button"
              disabled={isLoading}
              onClick={() => {
                const result = checkIfLicenseIsValid(licenseKey)

                if (result.success) {
                  onGoToWorkspace()
                } else {
                  setErrorMessage(result.errorMessage!)
                }
              }}
            >
              Submit
            </button>
            <button
              data-testid="cancel-button"
              disabled={isLoading}
              onClick={() => { onGoToWorkspace() }}
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
