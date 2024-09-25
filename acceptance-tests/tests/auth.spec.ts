import { existsSync } from 'fs';
import { describe, beforeAll, it, expect, afterAll } from 'vitest';
import { ENTER } from '../lib/prompt';

import { TestState } from '../lib/testState';

describe('hs auth', () => {
  let testState: TestState;

  beforeAll(async () => {
    testState = new TestState();
    await testState.withAuth();
  });

  afterAll(() => {
    testState.cleanup();
  });

  it('should begin with a config file present', async () => {
    expect(existsSync(testState.getTestConfigFileName())).toBe(true);
  });

  it('should update the tokens for the existing configured account', async () => {
    await testState.cli.execute(
      ['auth', `--c="${testState.getTestConfigFileName()}"`],
      [ENTER, testState.getPAK(), ENTER]
    );

    expect(existsSync(testState.getTestConfigFileName())).toBe(true);
  });
});
