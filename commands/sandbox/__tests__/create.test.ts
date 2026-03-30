import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addTestingOptions,
} from '../../../lib/commonOpts.js';
import sandboxCreateCommand, { SandboxCreateArgs } from '../create.js';
import * as sandboxPrompts from '../../../lib/prompts/sandboxesPrompt.js';
import * as accountNamePrompt from '../../../lib/prompts/accountNamePrompt.js';
import * as configUtils from '@hubspot/local-dev-lib/config';
import * as promptUtils from '../../../lib/prompts/promptUtils.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import * as buildAccount from '../../../lib/buildAccount.js';
import { V2Sandbox } from '@hubspot/local-dev-lib/types/Sandbox';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import * as sandboxesLib from '../../../lib/sandboxes.js';
import { vi } from 'vitest';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/hasFeature');
vi.mock('../../../lib/prompts/sandboxesPrompt');
vi.mock('../../../lib/prompts/promptUtils');
vi.mock('../../../lib/prompts/accountNamePrompt');
vi.mock('../../../lib/sandboxes');
vi.mock('../../../lib/buildAccount');
vi.mock('../../../lib/sandboxes');
vi.mock('../../../lib/commonOpts');

const getConfigAccountByIdSpy = vi.spyOn(configUtils, 'getConfigAccountById');
const promptUserSpy = vi.spyOn(promptUtils, 'promptUser');
const sandboxTypePromptSpy = vi.spyOn(sandboxPrompts, 'sandboxTypePrompt');
const processExitSpy = vi.spyOn(process, 'exit');
const buildV2SandboxSpy = vi.spyOn(buildAccount, 'buildV2Sandbox');
const getConfigAccountEnvironmentSpy = vi.spyOn(
  configUtils,
  'getConfigAccountEnvironment'
);
const validateSandboxUsageLimitsSpy = vi.spyOn(
  sandboxesLib,
  'validateSandboxUsageLimits'
);
const hubspotAccountNamePromptSpy = vi.spyOn(
  accountNamePrompt,
  'hubspotAccountNamePrompt'
);

describe('commands/sandbox/create', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(sandboxCreateCommand.command).toEqual('create');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(sandboxCreateCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      sandboxCreateCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<SandboxCreateArgs>;
    const sandboxNameFromPrompt = 'sandbox name from prompt';
    const mockSandbox = {
      sandboxHubId: 56789,
      parentHubId: 123456,
      createdAt: '2025-01-01',
      type: 'DEVELOPER',
      archived: false,
      version: 'V1',
      status: 'PENDING',
      name: 'Test Sandbox',
      domain: 'test-sandbox.hubspot.com',
      createdByUser: {
        userId: 11111,
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
      },
    };

    beforeEach(() => {
      args = {
        derivedAccountId: 1234567890,
      } as ArgumentsCamelCase<SandboxCreateArgs>;
      getConfigAccountByIdSpy.mockReturnValue({
        accountId: 1234567890,
        accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
        env: 'prod',
      } as HubSpotConfigAccount);
      hubspotAccountNamePromptSpy.mockResolvedValue({
        name: sandboxNameFromPrompt,
      });

      sandboxTypePromptSpy.mockResolvedValue({
        type: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
      });
      promptUserSpy.mockResolvedValue({
        contactRecordsSyncPrompt: false,
      });

      validateSandboxUsageLimitsSpy.mockResolvedValue(undefined);
      getConfigAccountEnvironmentSpy.mockReturnValue(ENVIRONMENTS.PROD);
      buildV2SandboxSpy.mockResolvedValue({
        sandbox: { ...mockSandbox, version: 'V2' } as V2Sandbox,
      });

      // Spy on process.exit so our tests don't close when it's called
      // @ts-expect-error Doesn't match the actual signature because then the linter complains about unused variables
      processExitSpy.mockImplementation(() => {});
    });
    it('should load the account config for the correct account id', async () => {
      await sandboxCreateCommand.handler(args);
      expect(getConfigAccountByIdSpy).toHaveBeenCalledTimes(2); // 1st is for parent account, 2nd is for sandbox account
      expect(getConfigAccountByIdSpy).toHaveBeenCalledWith(
        args.derivedAccountId
      );
    });

    it('should track the command usage', async () => {
      await sandboxCreateCommand.handler(args);
      expect(trackCommandUsage).toHaveBeenCalledTimes(1);
      expect(trackCommandUsage).toHaveBeenCalledWith(
        'sandbox-create',
        {},
        args.derivedAccountId
      );
    });

    it('should validate sandbox usage limits', async () => {
      await sandboxCreateCommand.handler(args);
      expect(validateSandboxUsageLimitsSpy).toHaveBeenCalledTimes(1);
      expect(validateSandboxUsageLimitsSpy).toHaveBeenCalledWith(
        {
          accountId: 1234567890,
          accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
          env: 'prod',
        },
        HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
        'prod'
      );
    });

    it('should prompt for the sandbox type if no type is provided in options', async () => {
      await sandboxCreateCommand.handler(args);
      expect(sandboxTypePromptSpy).toHaveBeenCalledTimes(1);
    });

    it('should not prompt for the sandbox type if type is provided in options', async () => {
      await sandboxCreateCommand.handler({
        ...args,
        type: 'developer',
      });
      expect(sandboxTypePromptSpy).toHaveBeenCalledTimes(0);
    });

    it('should not prompt for contact records sync if the sandbox type is developer', async () => {
      await sandboxCreateCommand.handler({
        ...args,
        type: 'developer',
      });
      expect(promptUserSpy).toHaveBeenCalledTimes(0);
    });

    it('should prompt for the contact records sync if the sandbox type is standard', async () => {
      await sandboxCreateCommand.handler({
        ...args,
        type: 'standard',
      });
      expect(promptUserSpy).toHaveBeenCalledTimes(1);
    });

    it('should build a v2 sandbox', async () => {
      await sandboxCreateCommand.handler(args);
      expect(buildV2SandboxSpy).toHaveBeenCalledTimes(1);
      expect(buildV2SandboxSpy).toHaveBeenCalledWith(
        sandboxNameFromPrompt,
        {
          accountId: 1234567890,
          accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
          env: 'prod',
        },
        HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
        false, // syncObjectRecords
        'prod',
        undefined // force
      );
    });

    it('should log an error and exit when force is used and invalid sandbox type is provided', async () => {
      await sandboxCreateCommand.handler({
        ...args,
        name: sandboxNameFromPrompt,
        type: 'invalid',
        force: true,
      });
      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when force is used and no sandbox name is provided', async () => {
      await sandboxCreateCommand.handler({
        ...args,
        type: 'standard',
        force: true,
      });
      expect(uiLogger.error).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should error out if the default account type is not standard', async () => {
      getConfigAccountByIdSpy.mockReturnValue({
        accountId: 1234567890,
        accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
        env: 'prod',
      } as HubSpotConfigAccount);
      await sandboxCreateCommand.handler({
        ...args,
        type: 'developer',
      });
      expect(uiLogger.error).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
