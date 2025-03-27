import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';
import tseslint from 'typescript-eslint';

import globals from 'globals';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';

export default tseslint.config(tseslint.configs.recommendedTypeChecked, {
  files: ['src/**/*.ts', 'example/**/*.ts', 'test/**/*.ts'],
  languageOptions: {
    parser,
    parserOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
    globals: globals.node,
  },
  plugins: {
    '@typescript-eslint': plugin,
  },
  ...eslintPluginPrettier,
});
