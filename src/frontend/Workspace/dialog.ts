import Swal from 'sweetalert2'
import './dialog.scss'

function showDialog (title: string, messageHtml: string, showConfirmButton: boolean = true): void {
  void Swal.fire({
    title,
    html: messageHtml,
    customClass: {
      title: 'dialog-title',
      htmlContainer: 'dialog-content',
      confirmButton: 'dialog-button',
      actions: 'dialog-actions'
    },
    showConfirmButton,
    confirmButtonText: 'Close',
    confirmButtonColor: '#333',
    allowOutsideClick: false,
    allowEscapeKey: false,
    animation: false
  })
}

export function showError (
  title: string,
  errorMessage: string,
  preBody: string | null = null,
  postBody: string | null = null
): void {
  preBody ||= "Here's the error:'"
  postBody ||= 'Please try again. If the problem persists, please contact support@superintendent.app.'

  showDialog(
    `<i class="fas fa-exclamation-circle error"></i><span class="title">${title}</span>`,
    `<div class="pre-text">${preBody}</div><div class="error">${errorMessage}</div><div class="post-text">${postBody}</div>`
  )
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
