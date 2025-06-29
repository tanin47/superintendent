import { Sheet, type Result, generateWorkspaceItemId } from '../Workspace/types'
import { type CopySelection, type EditorMode, type ExportedWorkflow, ExportWorkflowChannel, type SortDirection, type ColumnType } from '../../types'
import { trackEvent } from '../telemetryRenderer'

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

export function getInitialFile (): string | null {
  return urlParams.get('initialFile')
}

export function convertFileList (fileList: FileList | null): string[] {
  const results: string[] = []

  if (fileList != null) {
    for (const file of fileList) {
      results.push(window.webUtils.getPathForFile(file))
    }
  }

  return results
}

export const ERROR_REPORTING_OPT_IN_KEY = 'errorReportingOptIn'

export function getErrorReportingOptIn (): boolean | null {
  return window.storeApi.get(ERROR_REPORTING_OPT_IN_KEY) as (boolean | undefined) ?? null
}

export function setErrorReportingOptIn (isReporting: boolean): void {
  window.storeApi.set(ERROR_REPORTING_OPT_IN_KEY, isReporting)
}

export const PURCHASE_NOTICE_SHOWN_AT_KEY = 'purchaseNoticeShownAt'

export function getPurchaseNoticeShownAt (): number | null {
  return window.storeApi.get(PURCHASE_NOTICE_SHOWN_AT_KEY) as (number | undefined) ?? null
}

export function setPurchaseNoticeShownAt (): void {
  window.storeApi.set(PURCHASE_NOTICE_SHOWN_AT_KEY, new Date().getTime())
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

export function extractLicenseExpiredAt (licenseKey: string | null | undefined): Date | null {
  if (!licenseKey) { return null }

  const expiredAt = extractLicenseInfo(licenseKey, 'Expired')

  if (expiredAt == null) { return null }

  return new Date(Date.parse(expiredAt.endsWith('Z') ? expiredAt : `${expiredAt}Z`))
}

export function verifyExpiredAt (licenseKey: string): boolean {
  const expiredDate = extractLicenseExpiredAt(licenseKey)

  if (!expiredDate) { return false }

  const now = new Date()

  return now.getTime() < expiredDate.getTime()
}

export interface LicenseKeyValidity {
  state: 'valid' | 'invalid'
  expiredAt: Date | null
}

export const LICENSE_KEY = 'license-key'
let cachedHasValidLicense: LicenseKeyValidity | null = null
export function hasValidLicense (forceCheck: boolean = false): LicenseKeyValidity {
  if (!forceCheck) {
    if (cachedHasValidLicense === null) {
      // do nothing
    } else {
      return cachedHasValidLicense
    }
  }

  const licenseKey = window.storeApi.get(LICENSE_KEY) as string | null | undefined
  const result = checkIfLicenseIsValid(licenseKey)

  cachedHasValidLicense = {
    state: result.success ? 'valid' : 'invalid',
    expiredAt: extractLicenseExpiredAt(licenseKey)
  }
  return cachedHasValidLicense
}

export function checkIfLicenseIsValid (licenseKey: string | null | undefined): CheckIfLicenseIsValidResult {
  try {
    if (!licenseKey || !verifySignature(licenseKey)) {
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

    window.storeApi.set(LICENSE_KEY, licenseKey)
    cachedHasValidLicense = {
      state: 'valid',
      expiredAt: extractLicenseExpiredAt(licenseKey)
    }

    return { success: true }
  } catch (error) {
    console.log(error)
    return {
      success: false,
      errorMessage: 'The license key is not valid. Please contact support@superintendent.app.'
    }
  }
}

export async function maybeShowPurchaseNotice (force: boolean = false): Promise<void> {
  if (hasValidLicense(true).state === 'valid') { return }

  const latest = getPurchaseNoticeShownAt()

  const now = new Date().getTime()

  if (force || latest === null || (now - latest) > (6 * 60 * 60 * 1000)) { // 6 hours
    setPurchaseNoticeShownAt()
    await window.ipcRenderer.invoke('show-purchase-notice')
  }
}

export async function update (q: string, replace: Result): Promise<Result> {
  void trackEvent('updating')

  return await window.ipcRenderer
    .invoke('update', q, replace.name)
    .then((result) => {
      if (result.success === true) {
        void trackEvent('updating_succeeded')

         
        replace.update(result.data, true)
        return replace
      } else {
        void trackEvent('updating_failed')
        throw result.message
      }
    })
}

export async function query (q: string, replace: Result | null): Promise<Result> {
  void trackEvent('querying')

  return await window.ipcRenderer
    .invoke('query', q, replace?.name ?? null)
    .then((result) => {
      if (result.success === true) {
        void trackEvent('querying_succeeded', { count: result.data.count })

        if (replace && replace.name === result.data.name) {
           
          replace.update(result.data, false)
          return replace
        } else {
           
          return new Sheet({
            id: generateWorkspaceItemId(),
            presentationType: 'table',
            ...result.data
          })
        }
      } else {
        void trackEvent('querying_failed')
        throw result.message
      }
    })
}

export async function sort (result: Result, column: string, direction: SortDirection): Promise<Result> {
  void trackEvent('sorting')

  const sorts = result.sorts.filter((s) => s.name !== column)
  if (direction !== 'none') {
    sorts.push({ name: column, direction })
  }

  return await window.ipcRenderer
    .invoke('sort', result.name, sorts)
    .then((newResult) => {
      if (newResult.success === true) {
        void trackEvent('sorting_succeeded')

         
        result.update(newResult.data, true)
        result.updateSorts(sorts)
        return result
      } else {
        void trackEvent('sorting_failed')
        throw newResult.message
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
        throw result.message
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
        throw result.message
      }
    })
}

export async function addCsv (path: string, withHeader: boolean, format: string, replace: Sheet | null, autoDetect: boolean): Promise<Sheet> {
  void trackEvent('adding_csv', { withHeader, format, autoDetect })

  return await window.ipcRenderer
    .invoke('add-csv', path, withHeader, format, replace?.name, autoDetect)
    .then((result) => {
      if (result.success === true) {
        void trackEvent('adding_csv_succeeded', { count: result.data.count, withHeader, format, autoDetect })
        void maybeShowPurchaseNotice()

        if (replace) {
           
          replace.update(result.data, false)
          return replace
        } else {
           
          return new Sheet({
            presentationType: 'table',
            id: generateWorkspaceItemId(),
            isCsv: true,
            ...result.data
          })
        }
      } else {
        void trackEvent('adding_csv_failed', { withHeader, format, autoDetect })
        throw result.message
      }
    })
}

export async function exportWorkflow (file: string, workflow: ExportedWorkflow): Promise<{ file: string }> {
  return await window.ipcRenderer
    .invoke(ExportWorkflowChannel, file, workflow)
    .then((result) => {
      if (result.success) {
        return result.data
      } else {
        throw result.message
      }
    })
}

export async function downloadCsv (table: string): Promise<string> {
  void trackEvent('downloading_csv')

  return await window.ipcRenderer
    .invoke('download-csv', table)
    .then((result) => {
      if (result.success) {
        void trackEvent('downloading_csv_succeeded')

        return result.data
      } else {
        void trackEvent('downloading_csv_failed')
        throw result.message
      }
    })
}

export async function drop (table: string): Promise<void> {
  await window.ipcRenderer
    .invoke('drop', table)
    .then((_result) => {
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
        throw result.message
      }
    })
}

export async function changeColumnType (result: Result, columnName: string, newType: ColumnType, timestampFormat: string | null = null): Promise<Result> {
  void trackEvent('changing_column')

  return await window.ipcRenderer
    .invoke('change-column-type', result.name, columnName, newType, timestampFormat)
    .then((newResult) => {
      if (newResult.success === true) {
        void trackEvent('changing_column_succeeded')
         
        result.update(newResult.data, true)
        return result
      } else {
        void trackEvent('changing_column_failed')
        throw newResult.message
      }
    })
}
