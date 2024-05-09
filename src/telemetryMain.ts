import { type CaptureExceptionFunction, type TrackEventFunction } from './types'
import * as Aptabase from '@aptabase/electron/main'
import * as Sentry from '@sentry/electron/main'

const isInTest = process.env.ENABLE_WDIO === 'yes' || !!process.env.JEST_WORKER_ID

let trackEventProxy: TrackEventFunction
let captureExceptionProxy: CaptureExceptionFunction

if (isInTest) {
  trackEventProxy = async () => { await Promise.resolve() }

  captureExceptionProxy = () => ''
} else {
  Sentry.init({ dsn: 'https://ffa45e5490e645f694fb3bb0775d2c2a@app.glitchtip.com/6548', maxValueLength: 3000 })

  trackEventProxy = Aptabase.trackEvent
  captureExceptionProxy = Sentry.captureException
}

export function initialize (): void {
  if (isInTest) { return }
  void Aptabase.initialize('A-US-0398660071')
}

export { trackEventProxy as trackEvent, captureExceptionProxy as captureException }
