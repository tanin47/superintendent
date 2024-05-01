import Swal from 'sweetalert2'
import './dialog.scss'
import { getErrorReportingOptIn, hasValidLicense, setErrorReportingOptIn } from '../api'

import { type ErrorContext } from '../../types'
import { captureException } from '../telemetryRenderer'

const SWAL_OPTIONS = {
  customClass: {
    title: 'dialog-title',
    htmlContainer: 'dialog-content',
    confirmButton: 'dialog-button',
    actions: 'dialog-actions',
    input: 'dialog-input'
  },
  confirmButtonText: 'Close',
  confirmButtonColor: '#333',
  allowOutsideClick: false,
  allowEscapeKey: false,
  animation: false

}

function showDialog (title: string, messageHtml: string, showConfirmButton: boolean = true): void {
  void Swal.fire({
    title,
    html: messageHtml,
    showConfirmButton,
    ...SWAL_OPTIONS
  })
}

export async function showError (
  title: string,
  errorMessage: string,
  errorContext: ErrorContext,
  postBody: string | null = null
): Promise<void> {
  postBody ||= 'Please contact support@superintendent.app if you need help.'

  let checkboxAttributeString = ''
  let trialDisclosureText: string

  if (getErrorReportingOptIn() === true) {
    checkboxAttributeString = 'checked'
  }

  const isLicenseValid = hasValidLicense(true).state === 'valid'

  if (isLicenseValid) {
    trialDisclosureText = 'Please consider reporting the error as it is helpful for improving the product.'
  } else {
    checkboxAttributeString = 'checked disabled'
    trialDisclosureText = 'Since you are using the trial version, you cannot opt-out from error reporting.'
  }

  const errorReportingHtml = '<div class="error-reporting">' +
  `<div class="opt-in"><input type="checkbox" value="yes" id="errorReportingCheckbox" ${checkboxAttributeString}> <label for="errorReportingCheckbox">Report the error to Superintendent.app</label></div>` +
  '<div class="disclosure">Only the error and its context are reported. Your CSV data and query results are not included and will never leave your machine.</div>' +
  `<div class="disclosure">${trialDisclosureText}</div>` +
  '</div>'

  const result = await Swal.fire({
    title: `<i class="fas fa-exclamation-circle error"></i><span class="title">${title}</span>`,
    html: `<div class="error">${errorMessage}</div><div class="post-text">${postBody}</div>${errorReportingHtml}`,
    customClass: {
      title: 'dialog-title',
      htmlContainer: 'dialog-content',
      confirmButton: 'dialog-button',
      actions: 'dialog-actions',
      input: 'dialog-input'
    },
    showConfirmButton: true,
    confirmButtonText: 'Close',
    confirmButtonColor: '#333',
    allowOutsideClick: false,
    allowEscapeKey: false,
    animation: false,
    preConfirm: () => {
      return {
        optIn: (document.getElementById('errorReportingCheckbox') as HTMLInputElement)?.checked ?? false
      }
    }
  })

  const optIn = (result.value?.optIn ?? '') as boolean
  setErrorReportingOptIn(optIn)

  if (optIn || !isLicenseValid) {
    captureException(new Error(errorMessage), {
      tags: { action: errorContext.action },
      extra: errorContext.extras ?? {}
    })
  }
}

export function showSuccess (title: string, messageHtml: string): void {
  showDialog(
    `<i class="fas fa-check-circle success"></i><span class="title">${title}</span>`,
    messageHtml
  )
}

export function showLoading (title: string, messageHtml: string): void {
  showDialog(
    `<span class="spinner"></span><span class="title">${title}</span>`,
    messageHtml,
    false
  )
}

export function close (): void {
  Swal.close()
}
