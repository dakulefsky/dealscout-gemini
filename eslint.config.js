import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'server/data/**'] },
  {
    files: ['src/**/*.{js,jsx}'],
    ...js.configs.recommended,
    languageOptions: { ...js.configs.recommended.languageOptions, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['server/**/*.js'],
    ...js.configs.recommended,
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['server.js', '*.config.js'],
    ...js.configs.recommended,
    languageOptions: { sourceType: 'module', globals: globals.node },
    rules: { ...js.configs.recommended.rules, 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },
];
