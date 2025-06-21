import { trackEvent } from '@aptabase/electron/renderer'
import * as Sentry from '@sentry/electron/renderer'
import { type ExclusiveEventHintOrCaptureContext } from '@sentry/core/types/utils/prepareEvent'
import { type CaptureExceptionFunction, type TrackEventFunction } from '../types'

const isInTest = window.miscApi.isWdioEnabled()

let trackEventProxy: TrackEventFunction
let captureExceptionProxy: CaptureExceptionFunction

if (isInTest) {
  trackEventProxy = async () => { await Promise.resolve() }

  const captureExceptionCalls: any[][] = []
  captureExceptionProxy = (exception: any, hint?: ExclusiveEventHintOrCaptureContext) => {
    captureExceptionCalls.push([exception.message, hint])
    return ''
  }
  // @ts-expect-error for testing
  window.captureExceptionCalls = captureExceptionCalls
} else if (process.env.GLITCHTIP_URL) {
  Sentry.init({ dsn: process.env.GLITCHTIP_URL, maxValueLength: 3000 })

  trackEventProxy = trackEvent
  captureExceptionProxy = Sentry.captureException
} else {
  trackEventProxy = async () => { await Promise.resolve() }
  captureExceptionProxy = (_exception: any, _hint?: ExclusiveEventHintOrCaptureContext) => { return '' }
}

export { trackEventProxy as trackEvent, captureExceptionProxy as captureException }
