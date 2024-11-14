import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { TestState } from '../../lib/TestState';
import { getInitPromptSequence, ENTER } from '../../lib/prompt';

describe('Account Management Flow', () => {
  let testState: TestState;
  const accountName = 'test-account';

  beforeEach(async () => {
    testState = new TestState();
    await testState.cli.executeWithTestConfig(
      ['init'],
      getInitPromptSequence(testState.getPAK(), accountName)
    );
  });

  afterEach(() => {
    testState.cleanup();
  });

  describe('hs init', () => {
    it('should generate a config file', async () => {
      expect(
        testState.existsInTestOutputDirectory(
          testState.getTestConfigPathRelativeToOutputDir()
        )
      ).toBe(true);
    });
  });

  describe('hs accounts list', () => {
    it('should list the authenticated account', async () => {
      const output = await testState.cli.executeWithTestConfig([
        'accounts',
        'list',
      ]);

      expect(output).toContain(accountName);
    });
  });

  describe('hs accounts info', () => {
    it('should provide info for the authenticated account', async () => {
      const output = await testState.cli.executeWithTestConfig([
        'accounts',
        'info',
      ]);
      expect(output).toContain(accountName);
    });
  });

  describe('hs accounts remove', () => {
    it('should remove the authenticated account', async () => {
      await testState.cli.executeWithTestConfig([
        'accounts',
        'remove',
        `--account=${accountName}`,
      ]);

      const parsedConfig = testState.getParsedConfig();
      expect(parsedConfig.portals).toHaveLength(0);
    });
  });

  describe('hs auth', () => {
    it('should add the account to the config', async () => {
      await testState.cli.executeWithTestConfig(
        ['auth'],
        [ENTER, testState.getPAK(), ENTER]
      );

      const parsedConfig = testState.getParsedConfig();

      expect(parsedConfig.portals[0].personalAccessKey).toEqual(
        testState.getPAK()
      );
    });
  });
});
