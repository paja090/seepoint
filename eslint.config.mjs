import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: dirname });
const config = [
  {
    ignores: [
      '.next/**',
      '.worktrees/**',
      'data/**',
      'reports/**',
      'node_modules/**',
      'output/**',
      'scratch/**',
      'scratch_test.js',
      'tmp/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['scripts/**/*.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];
export default config;
