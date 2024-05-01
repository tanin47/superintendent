import { trackEvent } from '@aptabase/electron/renderer'
import * as Sentry from '@sentry/electron/renderer'
import { type ExclusiveEventHintOrCaptureContext } from '@sentry/core/types/utils/prepareEvent'
import { type CaptureExceptionFunction, type TrackEventFunction } from '../types'

Sentry.init({ dsn: 'https://ffa45e5490e645f694fb3bb0775d2c2a@app.glitchtip.com/6548', maxValueLength: 3000 })

const isWdioEnabled = window.miscApi.isWdioEnabled()

let trackEventProxy: TrackEventFunction
let captureExceptionProxy: CaptureExceptionFunction

if (isWdioEnabled) {
  trackEventProxy = async () => { await Promise.resolve() }

  const captureExceptionCalls: any[][] = []
  captureExceptionProxy = (exception: any, hint?: ExclusiveEventHintOrCaptureContext) => {
    captureExceptionCalls.push([exception.message, hint])
    return ''
  }
  // @ts-expect-error for testing
  window.captureExceptionCalls = captureExceptionCalls
} else {
  Sentry.init({ dsn: 'https://ffa45e5490e645f694fb3bb0775d2c2a@app.glitchtip.com/6548', maxValueLength: 3000 })

  trackEventProxy = trackEvent
  captureExceptionProxy = Sentry.captureException
}

export { trackEventProxy as trackEvent, captureExceptionProxy as captureException }
