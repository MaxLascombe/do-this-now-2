//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: [
      '.output/**',
      '.vercel/**',
      'eslint.config.js',
      'prettier.config.js',
    ],
  },
  ...tanstackConfig,
  {
    rules: {
      // Allow console.warn / console.error for surfacing real problems;
      // block stray console.log calls.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // Standalone dev scripts log freely to stdout.
  {
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
]
