module.exports = {
  extends: ['plugin:@typescript-eslint/recommended'],
  root: true,
  env: {
    browser: false,
    node: true,
    commonjs: true,
    es6: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
  },
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    'no-console': 'off',
    'no-return-await': 'error',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        caughtErrors: 'none',
      },
    ],
  },

  overrides: [
    {
      files: ['**/__tests__/**/*.ts', '**/__mocks__/**/*.ts'],
      env: {
        jest: true,
        node: true,
      },
    },
    {
      files: ['acceptance-tests/tests/**/*.ts'],
      env: {
        jasmine: true,
        node: true,
      },
    },
  ],
};
