// Polyfill must run before expo-router boots — some module in the
// dependency tree references SharedArrayBuffer as a bare identifier and
// Hermes throws a ReferenceError before any other code can run.
import './lib/polyfills'

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('expo-router/entry')
