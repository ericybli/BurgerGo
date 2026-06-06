import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import path from 'path';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const nextConfig = compat.extends('next/core-web-vitals');

export default [
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'public/**',
      'node_modules/**',
      'scripts/migrate.js',
      '**/*.tsbuildinfo',
    ],
  },
  ...nextConfig,
  {
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Relax noisy rules that valid existing patterns trigger
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'off',
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];
