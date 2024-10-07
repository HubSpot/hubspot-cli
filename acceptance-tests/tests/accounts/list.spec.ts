import { describe, beforeAll, it, expect, afterAll } from 'vitest';
import { TestState } from '../../lib/testState';

describe('hs accounts list', () => {
  let testState: TestState;

  beforeAll(async () => {
    testState = new TestState();
    await testState.withAuth();
  });

  afterAll(() => {
    testState.cleanup();
  });

  it('should update the default account', async () => {
    const val = await testState.cli.execute([
      'accounts',
      'list',
      `--c="${testState.getTestConfigFileRelative()}"`,
    ]);

    const { defaultPortal } = testState.getParsedConfig();

    expect(val).toContain(defaultPortal);
  });
});
