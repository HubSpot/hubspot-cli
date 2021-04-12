// Chalk can cause snapshots to with its styling, just disable the color instead
process.env.FORCE_COLOR = 0;

module.exports = {
  testEnvironment: 'node',
  projects: ['<rootDir>/packages/*'],
  roots: ['packages'],
  collectCoverage: true,
};
