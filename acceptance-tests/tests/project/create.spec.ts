import { CONFIG_FILE_NAME } from '../../lib/constants.js';
import { describe, beforeAll, it, expect, afterAll } from 'vitest';
import rimraf from 'rimraf';
import { existsSync } from 'fs';
import { withAuth } from '../helpers/auth';

const PROJECT_FOLDER = 'my-project';

const cleanup = () => {
  rimraf.sync(PROJECT_FOLDER);
};

describe('hs project create', () => {
  beforeAll(() => {
    withAuth();
    // cleanup();
  });
  // afterAll(cleanup);

  it('should create a project containing a private app', async () => {
    await global.cli.execute([
      'project',
      'create',
      `--name="${PROJECT_FOLDER}"`,
      `--location="${PROJECT_FOLDER}"`,
      '--template="getting-started-private-app"',
      `--c="${CONFIG_FILE_NAME}"`,
    ]);
    expect(existsSync(PROJECT_FOLDER)).toBe(true);
  });
});
