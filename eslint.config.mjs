import globals from 'globals';
import tseslint from 'typescript-eslint';

const sourceFiles = ['src/**/*.{js,mjs,ts}'];

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'app.js', 'auth.js', 'storage.js'] },
  {
    files: sourceFiles,
    extends: [...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['tests/e2e/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['tests/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    // Existing tests evaluate legacy code inside VM fixtures. Check correctness
    // without imposing formatting or unused-fixture cleanup on another owner.
    rules: {
      'no-undef': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'valid-typeof': 'error',
      'constructor-super': 'error',
    },
  },
);
