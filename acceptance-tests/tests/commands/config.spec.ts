import { describe, beforeAll, it, expect, afterAll } from 'vitest';
import { TestState } from '../../lib/TestState';
import { DOWN, ENTER } from '../../lib/prompt';

describe('hs config', () => {
  let testState: TestState;

  beforeAll(async () => {
    testState = new TestState();
    await testState.withAuth();
  });

  afterAll(() => {
    testState.cleanup();
  });

  describe('hs config set', () => {
    it('should set the default mode to draft', async () => {
      await testState.cli.executeWithTestConfig(
        ['config', 'set'],
        [ENTER, DOWN, ENTER]
      );
    });
  });
});
