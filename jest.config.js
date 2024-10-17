module.exports = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  roots: ['commands', 'lib'],
  collectCoverage: true,
  clearMocks: true,
};
