import React, {ReactElement} from 'react';
import './index.scss';
import {checkIfLicenseIsValid} from "../api";
import CheckLicenseForm from "./Form";

type Result = 'loading' | 'failed'

export default function CheckLicense({onFinished}: {onFinished: () => void}): ReactElement {
  const [result, setResult] = React.useState<Result>('loading');

  React.useEffect(
    () => {
      if (window.util.isWdioEnabled()) {
        const listener = () => { onFinished(); };
        window.ipcRenderer.on('bypass-license', listener);
        return () => {
          window.ipcRenderer.removeListener('bypass-license', listener);
        }
      }
    },
    [onFinished]
  );

  React.useEffect(() => {
    setTimeout(
      () => {
        const licenseKey = window.Store.get('license-key');

        if (!licenseKey) {
          setResult('failed');
          return;
        }

        const result = checkIfLicenseIsValid(licenseKey)

        if (result.success) {
          onFinished();
        } else {
          setResult('failed');
        }
      },
      100
    )
  }, []);

  if (result === 'loading') {
    return (
      <div id="checkLicense">
        <div className="loading">
          <span className="spinner" /> Loading...
        </div>
      </div>
    )
  } else if (result === 'failed') {
    return <CheckLicenseForm onFinished={onFinished} />;
  } else {
    throw new Error(); // impossible
  }
}
