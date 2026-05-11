//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  { ignores: ['.output/**', '.vercel/**'] },
  ...tanstackConfig,
  {
    rules: {
      // Allow console.warn / console.error for surfacing real problems;
      // block stray console.log calls.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]
