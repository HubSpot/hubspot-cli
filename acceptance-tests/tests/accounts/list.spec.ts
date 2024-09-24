import { getParsedConfig, withAuth } from '../helpers/auth';
import { describe, beforeAll, it, expect } from 'vitest';
import { CONFIG_FILE_NAME } from '../../lib/constants';

describe('hs accounts list', () => {
  beforeAll(withAuth);

  it('should update the default account', async () => {
    const val = await global.cli.execute([
      'accounts',
      'list',
      `--c="${CONFIG_FILE_NAME}"`,
    ]);

    const { defaultPortal } = getParsedConfig();

    expect(val).toContain(defaultPortal);
  }, 20000);
});
