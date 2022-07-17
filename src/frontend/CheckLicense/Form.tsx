import React, {ReactElement} from 'react';
import './Form.scss';
import {shell} from 'electron';
import {checkIfLicenseIsValid} from "../api";

export default function CheckLicenseForm({onFinished}: {onFinished: (evaluationMode: boolean) => void}): ReactElement {
  const [licenseKey, setLicenseKey] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const placeholder = React.useMemo(() => [
    '---- Superintendent license ----',
    'Type: Trial',
    'Name: Super Intendant',
    'Email: support@superintendent.app',
    'Key0: SomeKey0',
    'Key1:',
    'SomeKeyLine1',
    'SomeKeyLine2',
    '---- End of Superintendent license ----',
  ].join('\n'), []);

  return (
    <div id="checkLicenseForm">
      <div className="enter-license-form">
        <div className="label">Enter a license key:</div>
        <div className="field">
          <div className="input">
            <textarea
              disabled={isLoading}
              value={licenseKey}
              onChange={(event) => {setLicenseKey(event.target.value)}}
              placeholder={placeholder}
            />
          </div>
          <div className="remark">
            You can get a license key by clicking <span className="link" onClick={() => shell.openExternal('https://superintendent.app/buy')}>here</span>.
          </div>
        </div>
        <div className="cta">
          {errorMessage && (
            <div className="error-message">{errorMessage}</div>
          )}
          <div className="button-panel">
            <button
              disabled={isLoading}
              onClick={() => {
                const result = checkIfLicenseIsValid(licenseKey);

                if (result.success) {
                  onFinished(false);
                } else {
                  setErrorMessage(result.errorMessage!);
                }
              }}
            >Submit</button>
            <button onClick={() => onFinished(true)}>
              Use the evaluation mode
            </button>
          </div>
          <div className="remark">
            The evaluation mode is free and allows up to 100 rows per CSV.
          </div>
        </div>
      </div>
    </div>
  );
}
