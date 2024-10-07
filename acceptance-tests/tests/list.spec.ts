import { describe, beforeAll, it, expect, afterAll } from 'vitest';

import { TestState } from '../lib/testState';

describe('hs list', () => {
  let testState: TestState;

  beforeAll(async () => {
    testState = new TestState();
    await testState.withAuth();
  });

  afterAll(() => {
    testState.cleanup();
  });

  it('should print the correct output', async () => {
    const val = await testState.cli.execute([
      'list',
      `--c="${testState.getTestConfigFileRelative()}"`,
    ]);
    expect(val).toContain('CLI_TEST_TEMPLATE.html');
  });
});
