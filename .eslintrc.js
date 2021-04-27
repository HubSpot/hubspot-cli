module.exports = {
  extends: 'eslint:recommended',
  root: true,
  env: {
    browser: false,
    node: true,
    commonjs: true,
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    'no-console': 'off',
    'no-return-await': 'error',
  },

  overrides: [
    {
      files: ['**/__tests__/**/*.js', '**/__mocks__/**/*.js'],
      env: {
        jest: true,
        node: true,
      },
    },
    {
      files: ['acceptance-tests/tests/**/*.js'],
      env: {
        jasmine: true,
        node: true,
      },
    },
  ],
};
