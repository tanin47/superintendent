import { format } from 'sql-formatter'

export function formatTotal (total: number): string {
  const unit = total === 1 ? 'row' : 'rows'
  return `${total.toLocaleString('en-US')} ${unit}`
}

export function makeCopy<T> (original: T | null): T | null {
  if (original === null) { return null }
  return { ...original }
}

export function formatSql (sql: string): string {
  return format(
    sql,
    {
      language: 'postgresql',
      linesBetweenQueries: 2
    }
  )
}
