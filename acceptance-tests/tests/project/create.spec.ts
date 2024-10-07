import { describe, beforeAll, it, expect, afterAll } from 'vitest';
import rimraf from 'rimraf';
import { TestState } from '../../lib/testState';

const PROJECT_FOLDER = 'my-project';

const cleanup = (testState: TestState) => {
  rimraf.sync(testState.getPathWithinTestDirectory(PROJECT_FOLDER));
};

describe('hs project create', () => {
  let testState: TestState;

  beforeAll(async () => {
    testState = new TestState();
    await testState.withAuth();
    cleanup(testState);
  });

  afterAll(() => {
    cleanup(testState);
    testState.cleanup();
  });

  it('should create a project containing a private app', async () => {
    await testState.cli.execute([
      'project',
      'create',
      `--name="${PROJECT_FOLDER}"`,
      `--location="${PROJECT_FOLDER}"`,
      '--template="getting-started-private-app"',
      `--c="${testState.getTestConfigFileNameRelative()}"`,
    ]);
    expect(testState.existsInProjectFolder(PROJECT_FOLDER)).toBe(true);
  });
});
