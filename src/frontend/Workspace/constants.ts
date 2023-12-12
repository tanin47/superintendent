
export function ctrlCmdChar() {
  return window.util.getPlatform() === 'darwin' ? '⌘' : 'Ctrl';
}
export function altOptionChar() {
  return window.util.getPlatform() === 'darwin' ? '⌥' : 'Alt';
}
