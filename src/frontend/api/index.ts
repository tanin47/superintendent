import { Sheet, type Result, generateWorkspaceItemId } from '../Workspace/types'
import { type CopySelection, type EditorMode, type ExportedWorkflow, ExportWorkflowChannel, type SortDirection, type ColumnType } from '../../types'
import { trackEvent } from '@aptabase/electron/renderer'
import * as Sentry from '@sentry/electron/renderer'

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
      results.push(file.path)
    }
  }

  return results
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

  if (force || latest === null || (now - latest) > (6 * 60 * 60 * 1000)) { // 12 hours
    setPurchaseNoticeShownAt()
    await window.ipcRenderer.invoke('show-purchase-notice')
  }
}

export async function query (q: string, replace: Result | null): Promise<Result> {
  void trackEvent('querying')

  return await window.ipcRenderer
    .invoke('query', q, replace?.name ?? null)
    .then((result) => {
      if (result.success === true) {
        void trackEvent('querying_succeeded', { count: result.data.count })

        if (replace && replace.name === result.data.name) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          replace.update(result.data, false)
          return replace
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          return new Sheet({
            id: generateWorkspaceItemId(),
            presentationType: 'table',
            ...result.data
          })
        }
      } else {
        void trackEvent('querying_failed', { error: result.message })
        Sentry.captureException(new Error(result.message as string), {
          tags: { action: 'querying_failed' }
        })
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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        result.update(newResult.data, true)
        result.updateSorts(sorts)
        return result
      } else {
        void trackEvent('sorting_failed', { error: newResult.message })
        Sentry.captureException(new Error(newResult.message as string), {
          tags: { action: 'sorting_failed' }
        })
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

export async function addCsv (path: string, withHeader: boolean, format: string, replace: Sheet | null): Promise<Sheet> {
  void trackEvent('adding_csv')

  return await window.ipcRenderer
    .invoke('add-csv', path, withHeader, format, replace?.name)
    .then((result) => {
      if (result.success === true) {
        void trackEvent('adding_csv_succeeded', { count: result.data.count })
        void maybeShowPurchaseNotice()

        if (replace) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          replace.update(result.data, false)
          return replace
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          return new Sheet({
            presentationType: 'table',
            id: generateWorkspaceItemId(),
            isCsv: true,
            ...result.data
          })
        }
      } else {
        void trackEvent('adding_csv_failed', { error: result.message, path, withHeader, format })
        Sentry.captureException(new Error(result.message as string), {
          tags: { action: 'adding_csv_failed' },
          extra: { path, withHeader, format }
        })
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
        void trackEvent('downloading_csv_failed', { error: result.message })
        Sentry.captureException(new Error(result.message as string), {
          tags: { action: 'downloading_csv_failed' }
        })

        throw result.message
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        result.update(newResult.data, true)
        return result
      } else {
        void trackEvent('changing_column_failed', { error: newResult.message })
        Sentry.captureException(new Error(newResult.message as string), {
          tags: { action: 'changing_column_failed' }
        })
        throw newResult.message
      }
    })
}

export interface AiQuery {
  description: string
  sql: string
  isNewQuery: boolean
}

export interface AiResult {
  result: string
  description: string
  action: 'replace_selected_part' | 'replace_currently_viewed_sql' | 'make_new_sql'
}

export const MACHINE_USER_NAME_KEY = 'machineUserName'

function getMachineUsername (): string {
  let user = window.storeApi.get(MACHINE_USER_NAME_KEY)

  if (!user) {
    user = `user-${new Date().getTime()}-${Math.random()}`
    window.storeApi.set(MACHINE_USER_NAME_KEY, user)
  }

  return user
}

const AI_PRIVATE_KEY = 'MIICdQIBADANBgkqhkiG9w0BAQEFAASCAl8wggJbAgEAAoGBAI3vGHwB1si7ak1fprAFkRUmfHtACNuFxLodogeS73yqIMrSlJh6+hpSmT9dOpuEtrUYVesTbUzhz6vA3VaGxg6cw59uZ7LrGU+XPvLOh6AhBiMfW86oZcKE4CmjyN+8j37AwF3l/Apg5EGr/qY74zrutCeYPjb2KH5JFArmvcozAgMBAAECgYBX0caOg/zHet7NPQ+//dHFCmkfQYG5gk008zzb/thbhFCB7kWvCvhQ7SaRBDhNHZKG/qW6q+yHE3kRRmYtMXq9fwukmnZFmN+3yjSk9r4wDVcZs1Ev+iFdSGTBrZ48rtSwq3yq17D34wOPdZEUmRP/XRHzEeXY/r6v3bIYq5hHQQJBAPqsJsZapihGIeyp1npuZOR3+9M0ufa27Nvq+O0GgOB+7gNU8XabzupPvPQU9ChWobfWkHK4n+caeWzCSYtd2fECQQCQ81L9xBgeF7+Do9NdTv1R2UYg45jliy5wCat6V7A0ZyKS1cLMGvQ2bdDJB+WaiL6h1zaUt3VrGmbQT9iuCKJjAkB1iBIGHqqZZ4iwdlFhxjD4Dmm8dZRb4RjdZCaiu9HhcKIYXdN5UUSLCCgIKWrxHu1kTO4dXANdUERuggoJlk+BAkBcJKIEOWzPbG9NQo5xiW4VYtZmv+gJO4HorOz6F9Ymac2bpBFx6EyIcSTBNqjppLXycbn7regRjrX/BFMMxuZbAkA5361DsGscHZLMFP8Yyu+lDw8olStqd8KdYiy8P2We642APc2o2YqL3K10S+UHaaRpElSedEXthQzJ2MikJYWp'

export function getAiApiSignature (body: string, timestamp: string, user: string): string {
  const content = [body, timestamp, user].join('--')
  return window.cryptoApi.sign(
    'sha1',
    content,
    '-----BEGIN PRIVATE KEY-----\n' + AI_PRIVATE_KEY + '\n-----END PRIVATE KEY-----'
  )
}

export async function askAi (command: string, selection: string | null, currentSql: string | null, sheets: Result[]): Promise<AiResult> {
  void trackEvent('ask_ai')

  try {
    const timestamp = new Date().getTime().toString()
    const user = getMachineUsername()

    if (!selection) { selection = null }
    if (!currentSql || selection) { currentSql = null }

    const body = JSON.stringify({
      command,
      selection,
      currentSql,
      tables: sheets.map((csv) => {
        return {
          name: csv.name,
          columns: csv.columns.map((column) => {
            return {
              name: column.name,
              type: column.tpe
            }
          })
        }
      })
    })
    const signature = getAiApiSignature(body, timestamp, user)

    const resp = await fetch(
      'http://localhost:9000/ai/ask',
      {
        method: 'POST',
        headers: {
          Authorization: `Superintendent.app Timestamp=${timestamp}, User=${user}, Signature=${signature}`,
          'Content-Type': 'application/json'
        },
        body
      }
    )

    const json = await resp.json()
    void trackEvent('ask_ai_succeeded')

    if (json.success) {
      return json.response
    } else if (json.errors) {
      throw new Error(json.errors[0] as string)
    } else {
      throw new Error('Unknown error has occurred.')
    }
  } catch (e) {
    const error = e as Error
    void trackEvent('ask_ai_failed', { message: error.message })
    Sentry.captureException(new Error(error.message), {
      tags: { action: 'ask_ai_failed' }
    })
    throw e
  }
}
