
export function ctrlCmdChar() {
  return window.miscApi.getPlatform() === 'darwin' ? '⌘' : 'Ctrl';
}
export function altOptionChar() {
  return window.miscApi.getPlatform() === 'darwin' ? '⌥' : 'Alt';
}
