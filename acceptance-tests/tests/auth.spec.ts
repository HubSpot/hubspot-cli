import { existsSync } from 'fs';

import { describe, beforeAll, it, expect } from 'vitest';

import * as cmd from './helpers/cmd';

import { CONFIG_FILE_NAME } from '../lib/constants';

import { withAuth } from './helpers/auth';

describe('hs auth', () => {
  // @ts-expect-error custom props on global
  const { cli, config } = global;

  beforeAll(withAuth);

  it('should begin with a config file present', async () => {
    expect(existsSync(CONFIG_FILE_NAME)).toBe(true);
  });

  it('should update the tokens for the existing configured account', async () => {
    await cli.execute(
      ['auth', `--c="${CONFIG_FILE_NAME}"`],
      [cmd.ENTER, config.personalAccessKey, cmd.ENTER]
    );

    expect(existsSync(CONFIG_FILE_NAME)).toBe(true);
  });
});
