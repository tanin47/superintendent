export function ctrlCmdChar (): string {
  return window.miscApi.getPlatform() === 'darwin' ? '⌘' : 'Ctrl'
}
export function altOptionChar (): string {
  return window.miscApi.getPlatform() === 'darwin' ? '⌥' : 'Alt'
}
