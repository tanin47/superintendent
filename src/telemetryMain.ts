import { type CaptureExceptionFunction, type TrackEventFunction } from './types'
import * as Aptabase from '@aptabase/electron/main'
import * as Sentry from '@sentry/electron/main'

const isInTest = process.env.ENABLE_WDIO === 'yes' || !!process.env.JEST_WORKER_ID

let trackEventProxy: TrackEventFunction
let captureExceptionProxy: CaptureExceptionFunction

if (isInTest) {
  trackEventProxy = async () => { await Promise.resolve() }

  captureExceptionProxy = () => ''
} else if (process.env.GLITCHTIP_URL) {
  Sentry.init({ dsn: process.env.GLITCHTIP_URL, maxValueLength: 3000 })

  captureExceptionProxy = Sentry.captureException
}

if (process.env.APTABASE_KEY) {
  trackEventProxy = Aptabase.trackEvent
} else {
  trackEventProxy = async () => { await Promise.resolve() }
}

export function initialize (): void {
  if (isInTest) { return }
  if (!process.env.APTABASE_KEY) { return }

  void Aptabase.initialize('A-US-0398660071')
}

export { trackEventProxy as trackEvent, captureExceptionProxy as captureException }
