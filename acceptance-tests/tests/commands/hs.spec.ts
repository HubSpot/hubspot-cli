import { describe, beforeAll, it, expect, afterAll } from 'vitest';
import { TestState } from '../../lib/TestState';

describe('hs', () => {
  let testState: TestState;

  beforeAll(async () => {
    testState = new TestState();
  });

  afterAll(() => {
    testState.cleanup();
  });

  describe('hs', () => {
    it('should log out the help message', async () => {
      const output = await testState.cli.executeWithTestConfig([]);

      expect(output).toContain(
        'The command line interface to interact with HubSpot'
      );
    });

    it('should log out the help message when --help is passed', async () => {
      const output = await testState.cli.executeWithTestConfig(['--help']);

      expect(output).toContain(
        'The command line interface to interact with HubSpot'
      );
    });

    it('should not throw when --version is passed', async () => {
      await testState.cli.executeWithTestConfig(['--version']);
    });
  });
});
