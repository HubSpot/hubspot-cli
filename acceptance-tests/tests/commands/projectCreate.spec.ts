import rimraf from 'rimraf';
import { v4 as uuidv4 } from 'uuid';
import { TestState } from '../../lib/TestState';

const PROJECT_FOLDER = uuidv4();

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
    await testState.cli.executeWithTestConfig([
      'project',
      'create',
      `--name="${PROJECT_FOLDER}"`,
      `--dest="${PROJECT_FOLDER}"`,
      '--template="getting-started-private-app"',
    ]);
    expect(testState.existsInTestOutputDirectory(PROJECT_FOLDER)).toBe(true);
  });
});
