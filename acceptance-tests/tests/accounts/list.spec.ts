const { getParsedConfig, withAuth } = require('../helpers/auth');
const { CONFIG_FILE_NAME } = require('../../lib/constants');
import { describe, beforeAll, it, expect } from 'vitest';

describe('hs accounts list', () => {
  // @ts-expect-error custom prop on global
  const { cli } = global;

  beforeAll(withAuth);

  it('should update the default account', async () => {
    const val = await cli.execute([
      'accounts',
      'list',
      `--c="${CONFIG_FILE_NAME}"`,
    ]);

    const { defaultPortal } = getParsedConfig();

    expect(val).toContain(defaultPortal);
  }, 20000);
});
