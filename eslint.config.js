const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {ignores: ['dist/**', 'coverage/**', '.angular/**', 'node_modules/**']},
  {
    files: ['src/**/*.ts'],
    extends: [tseslint.configs.base, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      'no-constant-condition': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error',
      'no-loss-of-precision': 'error',
      'no-unreachable': 'error',
      // Existing public output names and constructor injection are compatible
      // APIs, not grounds for a broad refactor in the naming migration.
      '@angular-eslint/no-output-native': 'warn',
      '@angular-eslint/no-output-rename': 'warn',
      '@angular-eslint/prefer-inject': 'warn'
    }
  },
  {
    files: ['src/**/*.html'],
    extends: [...angular.configs.templateRecommended]
  }
);
