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

  it('should update the tokens for the existing configured account', async () => {
    expect(
      testState.existsInProjectFolder(testState.getTestConfigFileRelative())
    ).toBe(true);

    await testState.cli.execute(
      ['auth', `--c="${testState.getTestConfigFileRelative()}"`],
      [ENTER, testState.getPAK(), ENTER]
    );

    expect(
      testState.existsInProjectFolder(testState.getTestConfigFileRelative())
    ).toBe(true);
  });
});
