import { CONFIG_FILE_NAME } from '../lib/constants';

import { describe, beforeAll, it, expect } from 'vitest';

import { withAuth } from '../lib/auth';
import TestState from '../lib/testState';

describe('hs list', () => {
  beforeAll(withAuth);

  it('should print the correct output', async () => {
    let val = await TestState.cli.execute([
      'list',
      `--c="${CONFIG_FILE_NAME}"`,
    ]);
    expect(val).toContain('CLI_TEST_TEMPLATE.html');
  }, 20000);
});
