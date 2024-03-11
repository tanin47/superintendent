import { type Sheet } from '../Workspace/types'
import { type CopySelection, type EditorMode, type ExportedWorkflow, ExportWorkflowChannel, type SortDirection, type DatabaseEngine, type ColumnType } from '../../types'

const urlParams = new URLSearchParams(window.location.search)

export function getInitialEditorMode (): EditorMode {
  const mode = urlParams.get('editorMode')

  switch (mode) {
    case 'vim':
      return 'vim'
    case 'default':
      return 'default'
  }

  return 'default'
}

export function getInitialDatabaseEngine (): DatabaseEngine {
  const engine = urlParams.get('databaseEngine')

  switch (engine) {
    case 'sqlite':
      return 'sqlite'
    case 'duckdb':
      return 'duckdb'
  }

  return 'sqlite'
}

export function getInitialFile (): string | null {
  return urlParams.get('initialFile')
}

export function convertFileList (fileList: FileList | null): string[] {
  const results: string[] = []

  if (fileList != null) {
    for (const file of fileList) {
      results.push(file.path)
    }
  }

  return results
}

export interface CheckIfLicenseIsValidResult {
  success: boolean
  errorMessage?: string | null
}

export function extractLicenseInfo (licenseKey: string, key: string): string | null {
  const lines: string[] = []
  let isMatched = false

  licenseKey.split('\n').forEach((line) => {
    if (line.startsWith(`${key}:`)) {
      isMatched = true
      lines.push(line.substring(`${key}:`.length).trim())
      return
    }

    if ((line.startsWith('---') || line.match(/^[a-zA-Z0-9]+:/) != null) && isMatched) {
      isMatched = false
      return
    }

    if (isMatched) {
      lines.push(line.trim())
    }
  })

  if (lines.length === 0) { return null }

  return lines.join('\n').trim()
}

export function extractInput (licenseKey: string): string {
  const lines: string[] = []
  let isMatched = false

  licenseKey.split('\n').forEach((line) => {
    if (line.startsWith('---')) {
      isMatched = true
      return
    }

    if (line.startsWith('Signature:') && isMatched) {
      isMatched = false
      return
    }

    if (isMatched) {
      lines.push(line.trim())
    }
  })

  return lines.join('\n').trim()
}

const SIGNATURE_PUBLIC_KEY = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCJMEv39KhGzE6g/nuB1WZpi8CiTl9GVIH3lWclNI/FToulPEm+fz3oaU+47E/VCbW8dKUHkCJhql3qy3AObUyQqYYkoACLHukLnS0e8B7mOtrh2BsV0J7b0ESPBuQcYJbIEijm0lRpFhYzj1rea7xHaU2spezWm0OvaSSdeyBXfQIDAQAB'
export function verifySignature (licenseKey: string): boolean {
  const signature = extractLicenseInfo(licenseKey, 'Signature')
  const input = extractInput(licenseKey)

  if (signature == null || input === '') { return false }

  const cryptoPublicKey = '-----BEGIN PUBLIC KEY-----\n' + SIGNATURE_PUBLIC_KEY + '\n-----END PUBLIC KEY-----'

  return window.cryptoApi.verify(
    'sha1',
    input,
    cryptoPublicKey,
    signature
  )
}

export function verifyExpiredAt (licenseKey: string): boolean {
  const expiredAt = extractLicenseInfo(licenseKey, 'Expired')

  if (expiredAt == null) { return false }

  const expiredDateInMillis = Date.parse(expiredAt.endsWith('Z') ? expiredAt : `${expiredAt}Z`)
  const now = new Date()

  return now.getTime() < expiredDateInMillis
}

export function checkIfLicenseIsValid (licenseKey: string): CheckIfLicenseIsValidResult {
  try {
    if (!verifySignature(licenseKey)) {
      return {
        success: false,
        errorMessage: 'The license key is not valid. Please contact support@superintendent.app.'
      }
    }

    if (!verifyExpiredAt(licenseKey)) {
      return {
        success: false,
        errorMessage: 'The license key has expired. Please buy a new license at superintendent.app.'
      }
    }

    window.storeApi.set('license-key', licenseKey)

    return { success: true }
  } catch (error) {
    console.log(error)
    return {
      success: false,
      errorMessage: 'The license key is not valid. Please contact support@superintendent.app.'
    }
  }
}

export async function query (q: string, table: string | null): Promise<Sheet> {
  return await window.ipcRenderer
    .invoke('query', q, table)
    .then((result) => {
      if (result.success === true) {
        return {
          presentationType: 'table',
          ...result.data
        }
      } else {
        throw result
      }
    })
}

export async function sort (sheet: Sheet, column: string, direction: SortDirection): Promise<Sheet> {
  const sorts = sheet.sorts.filter((s) => s.name !== column)
  if (direction !== 'none') {
    sorts.push({ name: column, direction })
  }

  return await window.ipcRenderer
    .invoke('sort', sheet.name, sorts)
    .then((result) => {
      if (result.success === true) {
        return {
          ...sheet,
          presentationType: 'table',
          ...result.data,
          sorts,
          sql: sheet.sql,
          isLoading: false,
          isCsv: sheet.isCsv
        }
      } else {
        throw result
      }
    })
}

export async function loadMore (table: string, offset: number): Promise<string[][]> {
  return await window.ipcRenderer
    .invoke('load-more', table, offset)
    .then((result) => {
      if (result.success === true) {
        return result.data
      } else {
        throw result
      }
    })
}

export async function copy (table: string, selection: CopySelection): Promise<boolean> {
  return await window.ipcRenderer
    .invoke('copy', table, selection)
    .then((result) => {
      if (result.success === true) {
        return true
      } else {
        throw result
      }
    })
}

export async function addCsv (path: string, withHeader: boolean, format: string, replace: string): Promise<Sheet[] | null> {
  return await window.ipcRenderer
    .invoke('add-csv', path, withHeader, format, replace)
    .then((result) => {
      if (result.success === true) {
        if (!result.data) {
          return null
        } else {
          return result.data.map((item) => {
            return {
              presentationType: 'table',
              ...item
            }
          })
        }
      } else {
        throw result
      }
    })
}

export async function exportWorkflow (workflow: ExportedWorkflow): Promise<void> {
  await window.ipcRenderer
    .invoke(ExportWorkflowChannel, workflow)
    .then((result) => {
      if (result.success) {
        // do nothing
      } else {
        throw result
      }
    })
}

export async function downloadCsv (table: string): Promise<string> {
  return await window.ipcRenderer
    .invoke('download-csv', table)
    .then((result) => {
      if (result.success) {
        return result.data
      } else {
        throw result
      }
    })
}

export async function drop (table: string): Promise<void> {
  await window.ipcRenderer
    .invoke('drop', table)
    .then((result) => {
      // don't care
    })
}

export async function rename (previousTableName: string, newTableName: string): Promise<void> {
  await window.ipcRenderer
    .invoke('rename', previousTableName, newTableName)
    .then((result) => {
      if (result.success === true) {
        // Succeed.
      } else {
        throw result
      }
    })
}

export async function changeColumnType (tableName: string, columnName: string, newType: ColumnType, timestampFormat: string | null = null): Promise<Sheet> {
  return await window.ipcRenderer
    .invoke('change-column-type', tableName, columnName, newType, timestampFormat)
    .then((result) => {
      if (result.success === true) {
        return {
          ...result.data
        }
      } else {
        throw result
      }
    })
}
