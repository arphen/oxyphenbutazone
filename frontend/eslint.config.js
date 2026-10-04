import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  {
    ignores: ['dist/', 'node_modules/', 'public/', 'src/data/generatedScenarios.js'],
  },
  // Base rule sets first, so the project's own settings below can adjust them
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: { globals: globals.browser },
  },
  {
    // build tooling and tests that run under Node (the e2e suites also contain code that runs inside the page)
    files: ['vite*.js', 'vitest.config.js', 'scripts/**/*.{js,mjs,cjs}', 'e2e/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['sw.template.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'warn',
      'vue/multi-word-component-names': 'off',
    },
  },
];
