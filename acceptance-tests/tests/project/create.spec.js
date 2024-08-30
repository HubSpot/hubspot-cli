const rimraf = require('rimraf');
const { existsSync } = require('fs');
const { CONFIG_FILE_NAME } = require('../../lib/constants');
const { withAuth } = require('../helpers/auth');

const PROJECT_FOLDER = 'my-project';

const cleanup = () => {
  rimraf.sync(PROJECT_FOLDER);
};

describe('hs project create', () => {
  beforeAll(() => {
    withAuth();
    cleanup();
  });
  afterAll(cleanup);

  const { cli } = global;

  it('should create a project containing a private app', async () => {
    await cli.execute([
      'project',
      'create',
      `--name="${PROJECT_FOLDER}"`,
      `--location="${PROJECT_FOLDER}"`,
      '--template="getting-started"',
      `--c="${CONFIG_FILE_NAME}"`,
    ]);
    expect(existsSync(PROJECT_FOLDER)).toBe(true);
  });
});
