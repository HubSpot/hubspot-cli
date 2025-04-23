module.exports = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  roots: ['commands', 'lib', 'api'],
  collectCoverage: true,
  clearMocks: true,
};
