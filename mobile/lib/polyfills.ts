// Hermes (the JS engine Expo uses on iOS) doesn't have SharedArrayBuffer,
// and a few packages reference it as a bare identifier — so they throw a
// ReferenceError at boot rather than just being undefined. Stub it out as
// a normal ArrayBuffer; nothing in this app actually shares memory across
// workers so the stub never gets used for real.

const g = globalThis as unknown as { SharedArrayBuffer?: unknown }
if (typeof g.SharedArrayBuffer === 'undefined') {
  g.SharedArrayBuffer = ArrayBuffer
}

export {}
