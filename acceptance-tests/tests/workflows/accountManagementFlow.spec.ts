import { describe, beforeAll, it, expect, afterAll } from 'vitest';
import { TestState } from '../../lib/TestState';
import { getInitPromptSequence, ENTER } from '../../lib/prompt';

describe('Account Management Flow', () => {
  let testState: TestState;
  const accountName = 'test-account';

  beforeAll(async () => {
    testState = new TestState();
  });

  afterAll(() => {
    testState.cleanup();
  });

  describe('initial state', () => {
    it('config file should not exist', async () => {
      expect(
        testState.existsInTestOutputDirectory(
          testState.getTestConfigFileNameRelativeToOutputDir()
        )
      ).toBe(false);
    });
  });

  describe('hs init', () => {
    it('should generate a config file', async () => {
      await testState.cli.execute(
        [
          'init',
          `--c="${testState.getTestConfigFileNameRelativeToOutputDir()}"`,
        ],
        getInitPromptSequence(testState.getPAK(), accountName)
      );

      expect(
        testState.existsInTestOutputDirectory(
          testState.getTestConfigFileNameRelativeToOutputDir()
        )
      ).toBe(true);
    });
  });

  describe('hs accounts list', () => {
    it('should list the authenticated account', async () => {
      const output = await testState.cli.execute([
        'accounts',
        'list',
        `--c="${testState.getTestConfigFileNameRelativeToOutputDir()}"`,
      ]);

      expect(output).toContain(accountName);
    });
  });

  describe('hs accounts info', () => {
    it('should provide info for the authenticated account', async () => {
      const output = await testState.cli.execute([
        'accounts',
        'info',
        `--c="${testState.getTestConfigFileNameRelativeToOutputDir()}"`,
      ]);

      expect(output).toContain(accountName);
    });
  });

  describe('hs accounts remove', () => {
    it('should remove the authenticated account', async () => {
      await testState.cli.execute([
        'accounts',
        'remove',
        `--account=${accountName}`,
        `--c="${testState.getTestConfigFileNameRelativeToOutputDir()}"`,
      ]);
    });
  });

  describe('hs accounts list', () => {
    it('should not list the removed authenticated account', async () => {
      const output = await testState.cli.execute([
        'accounts',
        'list',
        `--c="${testState.getTestConfigFileNameRelativeToOutputDir()}"`,
      ]);

      expect(output).not.toContain(accountName);
    });
  });

  describe('hs auth', () => {
    it('should add the account to the config', async () => {
      await testState.cli.execute(
        [
          'auth',
          `--c="${testState.getTestConfigFileNameRelativeToOutputDir()}"`,
        ],
        [ENTER, testState.getPAK(), ENTER]
      );

      const parsedConfig = testState.getParsedConfig();

      expect(parsedConfig.portals[0].personalAccessKey).toEqual(
        testState.getPAK()
      );
    });
  });
});
