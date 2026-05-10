// Loaded by Metro as a polyfill (before any other module). Hermes doesn't
// expose SharedArrayBuffer, and a few packages reference it as a bare
// identifier — so they throw a ReferenceError before any other code can
// run. Stub it as ArrayBuffer; nothing in this app actually shares memory
// across workers.
if (typeof globalThis.SharedArrayBuffer === 'undefined') {
  globalThis.SharedArrayBuffer = ArrayBuffer
}
