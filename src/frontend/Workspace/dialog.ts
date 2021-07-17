import Swal from 'sweetalert2';

export function showError(title: string, message: string): void {
  Swal.fire({
    title,
    text: message,
    icon: 'error',
    confirmButtonText: 'Close',
    confirmButtonColor: '#333',
    allowOutsideClick: false,
    allowEscapeKey: false
  });
}

export function showSuccess(title: string, message: string): void {
  Swal.fire({
    title,
    text: message,
    icon: 'success',
    confirmButtonText: 'Close',
    confirmButtonColor: '#333',
    allowOutsideClick: false,
    allowEscapeKey: false
  });
}
