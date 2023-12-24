export function formatTotal (total: number): string {
  const unit = total === 1 ? 'row' : 'rows'
  return `${total.toLocaleString('en-US')} ${unit}`
}

export function makeCopy<T> (original: T | null): T | null {
  if (original === null) { return null }
  return { ...original }
}

export function isChartEnabled (rowCount: number | null | undefined): boolean {
  return !!rowCount && rowCount <= 11000
}
