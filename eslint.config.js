import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const sharedRules = {
  ...js.configs.recommended.rules,
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-empty': ['warn', { allowEmptyCatch: true }],
  'no-useless-escape': 'warn',
};

export default [
  { ignores: ['dist/**', 'node_modules/**', 'server/data/**'] },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    plugins: { react, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    settings: { react: { version: 'detect' } },
    rules: {
      ...sharedRules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['server/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: globals.node },
    rules: sharedRules,
  },
  {
    files: ['server.js', '*.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: sharedRules,
  },
];
