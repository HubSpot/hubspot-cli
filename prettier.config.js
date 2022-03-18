module.exports = {
  bracketSpacing: true,
  printWidth: 80,
  proseWrap: 'never',
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  useTabs: false,
  arrowParens: 'avoid',
  quoteProps: 'as-needed',
  requirePragma: false,
  overrides: [
    {
      files: ['*.lyaml'],
      options: {
        // Prevent wrapping behavior in lyaml files
        printWidth: 999,
        // Wrapping looks bad for certain strings that use newlines
        proseWrap: 'preserve',
        singleQuote: false,
      },
    },
  ],
};
