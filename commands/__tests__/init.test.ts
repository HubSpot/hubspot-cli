import yargs, { Argv } from 'yargs';
import { existsSync } from 'fs';
import * as configLib from '@hubspot/local-dev-lib/config';
import * as personalAccessKeyLib from '@hubspot/local-dev-lib/personalAccessKey';
import * as gitignoreLib from '@hubspot/local-dev-lib/gitignore';
import { addConfigOptions, addTestingOptions } from '../../lib/commonOpts.js';
import * as processLib from '../../lib/process.js';
import * as personalAccessKeyPromptLib from '../../lib/prompts/personalAccessKeyPrompt.js';
import * as accountNamePromptLib from '../../lib/prompts/accountNamePrompt.js';
import { showMcpPromotionNudge } from '../../lib/mcp/promotion.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import initCommand from '../init.js';

vi.mock('../../lib/commonOpts');
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/personalAccessKey');
vi.mock('@hubspot/local-dev-lib/gitignore');
vi.mock('../../lib/process.js');
vi.mock('../../lib/prompts/personalAccessKeyPrompt.js');
vi.mock('../../lib/prompts/accountNamePrompt.js');
vi.mock('../../lib/mcp/promotion.js');

const optionsSpy = vi
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);
const mockedExistsSync = vi.mocked(existsSync);
const mockedGlobalConfigFileExists = vi.mocked(
  configLib.globalConfigFileExists
);
const mockedGetConfigFilePath = vi.mocked(configLib.getConfigFilePath);
const mockedCreateEmptyConfigFile = vi.mocked(configLib.createEmptyConfigFile);
const mockedDeleteConfigFileIfEmpty = vi.mocked(
  configLib.deleteConfigFileIfEmpty
);
const mockedCheckAndAddConfigToGitignore = vi.mocked(
  gitignoreLib.checkAndAddConfigToGitignore
);
const mockedGetAccessToken = vi.mocked(personalAccessKeyLib.getAccessToken);
const mockedUpdateConfigWithAccessToken = vi.mocked(
  personalAccessKeyLib.updateConfigWithAccessToken
);
const mockedHandleExit = vi.mocked(processLib.handleExit);
const mockedPersonalAccessKeyPrompt = vi.mocked(
  personalAccessKeyPromptLib.legacyPersonalAccessKeyPrompt
);
const mockedCliAccountNamePrompt = vi.mocked(
  accountNamePromptLib.cliAccountNamePrompt
);
const mockedShowMcpPromotionNudge = vi.mocked(showMcpPromotionNudge);
const processExitSpy = vi.spyOn(process, 'exit');

describe('commands/init', () => {
  beforeEach(() => {
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    mockedExistsSync.mockReturnValue(false);
    mockedGlobalConfigFileExists.mockReturnValue(false);
    mockedGetConfigFilePath.mockReturnValue('/tmp/hubspot.config.yml');
    mockedCreateEmptyConfigFile.mockReturnValue(undefined);
    mockedDeleteConfigFileIfEmpty.mockReturnValue(undefined);
    mockedCheckAndAddConfigToGitignore.mockReturnValue(undefined);
    mockedHandleExit.mockImplementation(() => () => {});
    mockedPersonalAccessKeyPrompt.mockResolvedValue({
      personalAccessKey: 'test-key',
      env: 'prod',
    });
    mockedGetAccessToken.mockResolvedValue({
      portalId: 123456,
      accessToken: 'test-access-token',
      expiresAt: '2026-01-01T00:00:00.000Z',
      scopeGroups: ['content'],
      encodedOAuthRefreshToken: 'encoded-token',
      hubName: 'Test Hub',
      accountType: 'STANDARD',
    });
    mockedCliAccountNamePrompt.mockResolvedValue({ name: 'test-account' });
    mockedUpdateConfigWithAccessToken.mockResolvedValue({
      accountId: 123456,
      name: 'test-account',
      authType: 'personalaccesskey',
      env: 'prod',
      auth: { tokenInfo: { accessToken: 'test-token' } },
      personalAccessKey: 'test-key',
    });
    mockedShowMcpPromotionNudge.mockResolvedValue(undefined);
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(initCommand.command).toEqual('init');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(initCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      initCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalledTimes(1);
      expect(optionsSpy).toHaveBeenCalledWith({
        'auth-type': expect.objectContaining({
          type: 'string',
          choices: ['personalaccesskey', 'oauth2'],
          default: 'personalaccesskey',
        }),
        account: expect.objectContaining({ type: 'string' }),
        'disable-tracking': expect.objectContaining({
          type: 'boolean',
          hidden: true,
          default: false,
        }),
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargs);
    });
  });

  describe('handler', () => {
    it('should show MCP promotion nudge after successful setup', async () => {
      const exit = vi.fn();

      await initCommand.handler({
        _: ['init'],
        authType: 'personalaccesskey',
        disableTracking: false,
        qa: false,
        userProvidedAccount: undefined,
        addUsageMetadata: vi.fn(),
        exit,
      } as unknown as Parameters<typeof initCommand.handler>[0]);

      expect(mockedShowMcpPromotionNudge).toHaveBeenCalledWith('init');
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });
  });
});
