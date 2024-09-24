import { existsSync } from 'fs';
import { describe, beforeAll, it, expect } from 'vitest';
import { ENTER } from './helpers/cmd';

import { CONFIG_FILE_NAME } from '../lib/constants';
import { withAuth } from './helpers/auth';

describe('hs auth', () => {
  beforeAll(withAuth);

  it('should begin with a config file present', async () => {
    expect(existsSync(CONFIG_FILE_NAME)).toBe(true);
  });

  it('should update the tokens for the existing configured account', async () => {
    await global.cli.execute(
      ['auth', `--c="${CONFIG_FILE_NAME}"`],
      [ENTER, global.config.personalAccessKey, ENTER]
    );

    expect(existsSync(CONFIG_FILE_NAME)).toBe(true);
  });
});
