import { existsSync } from 'fs';
import { describe, beforeAll, it, expect } from 'vitest';
import { ENTER } from '../lib/cmd';

import { CONFIG_FILE_NAME } from '../lib/constants';
import { withAuth } from '../lib/auth';
import TestState from '../lib/testState';

describe('hs auth', () => {
  beforeAll(withAuth);

  it('should begin with a config file present', async () => {
    expect(existsSync(CONFIG_FILE_NAME)).toBe(true);
  });

  it('should update the tokens for the existing configured account', async () => {
    await TestState.cli.execute(
      ['auth', `--c="${CONFIG_FILE_NAME}"`],
      [ENTER, TestState.getPAK(), ENTER]
    );

    expect(existsSync(CONFIG_FILE_NAME)).toBe(true);
  });
});
