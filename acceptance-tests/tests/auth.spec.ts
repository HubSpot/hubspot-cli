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
      testState.existsInTestOutputDirectory(
        testState.getTestConfigFileNameRelativeToOutputDir()
      )
    ).toBe(true);

    await testState.cli.execute(
      ['auth', `--c="${testState.getTestConfigFileNameRelativeToOutputDir()}"`],
      [ENTER, testState.getPAK(), ENTER]
    );

    expect(
      testState.existsInTestOutputDirectory(
        testState.getTestConfigFileNameRelativeToOutputDir()
      )
    ).toBe(true);
  });
});
