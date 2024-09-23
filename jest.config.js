module.exports = {
  testEnvironment: 'node',
  roots: ['commands', 'lib'],
  collectCoverage: true,
  testPathIgnorePatterns: ['commands/functions/test.js'],
  clearMocks: true,
};
