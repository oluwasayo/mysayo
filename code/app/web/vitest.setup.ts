import '@mantine/core/styles.css'

import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

const RESIZE_OBSERVER_LOOP_MESSAGE =
  'ResizeObserver loop completed with undelivered notifications'

const ResizeObserverOriginal = window.ResizeObserver
window.ResizeObserver = class ResizeObserver extends ResizeObserverOriginal {
  constructor(callback: ResizeObserverCallback) {
    super((entries, observer) => {
      window.requestAnimationFrame(() => {
        callback(entries, observer)
      })
    })
  }
}

const CONSOLE_IGNORE_LIST = [
  'When testing, code that causes React state updates should be wrapped into act(...)',
  RESIZE_OBSERVER_LOOP_MESSAGE,
]

const shouldIgnore = (args: unknown[]) => {
  if (args.length === 1 && args[0] === null) {
    return true
  }

  const message = args
    .map(arg =>
      typeof arg === 'string'
        ? arg
        : arg instanceof Error
          ? arg.message
          : String(arg),
    )
    .join(' ')

  return CONSOLE_IGNORE_LIST.some(entry => message.includes(entry))
}

const consoleError = console.error
console.error = (...args: Parameters<Console['error']>) => {
  if (shouldIgnore(args)) {
    return
  }
  return consoleError.call(console, ...args)
}
