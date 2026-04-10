import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import { addAppSecret } from '@hubspot/local-dev-lib/api/devSecrets';
import { PublicApp } from '@hubspot/local-dev-lib/types/Apps';
import {
  secretNamePrompt,
  secretValuePrompt,
} from '../../../../lib/prompts/secretPrompt.js';
import { selectAppPrompt } from '../../../../lib/prompts/selectAppPrompt.js';
import { trackCommandUsage } from '../../../../lib/usageTracking.js';
import { logError } from '../../../../lib/errorHandlers/index.js';
import { uiLogger } from '../../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../../lib/enums/exitCodes.js';
import type { UsageTrackingArgs } from '../../../../types/Yargs.js';
import addAppSecretCommand from '../add.js';

vi.mock('../../../../lib/commonOpts');
vi.mock('@hubspot/local-dev-lib/api/devSecrets');
vi.mock('../../../../lib/prompts/secretPrompt.js');
vi.mock('../../../../lib/prompts/selectAppPrompt.js');
vi.mock('../../../../lib/errorHandlers/index.js');

const addAppSecretMock = vi.mocked(addAppSecret);
const secretNamePromptMock = vi.mocked(secretNamePrompt);
const secretValuePromptMock = vi.mocked(secretValuePrompt);
const selectAppPromptMock = vi.mocked(selectAppPrompt);
const trackCommandUsageMock = vi.mocked(trackCommandUsage);
const logErrorMock = vi.mocked(logError);
const processExitSpy = vi.spyOn(process, 'exit');

describe('commands/app/secret/add', () => {
  const yargsMock = yargs as Argv;
  const mockApp: Partial<PublicApp> = { id: 12345, name: 'Test App' };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    selectAppPromptMock.mockResolvedValue(mockApp as PublicApp);
    secretValuePromptMock.mockResolvedValue({ secretValue: 'test-value' });
    // @ts-expect-error
    addAppSecretMock.mockResolvedValue(undefined);
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(addAppSecretCommand.command).toEqual('add [name]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(addAppSecretCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      addAppSecretCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);
      expect(yargsMock.positional).toHaveBeenCalledWith(
        'name',
        expect.objectContaining({
          type: 'string',
        })
      );
      expect(yargsMock.option).toHaveBeenCalledWith(
        'app',
        expect.objectContaining({
          type: 'number',
        })
      );
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<
      {
        name?: string;
        app?: number;
        derivedAccountId: number;
        d: boolean;
        debug: boolean;
      } & UsageTrackingArgs
    >;

    beforeEach(() => {
      args = {
        name: 'test-secret',
        derivedAccountId: 123456,
        d: false,
        debug: false,
        addUsageMetadata: vi.fn(),
        exit: vi.fn(),
        _: [],
        $0: '',
      } as ArgumentsCamelCase<
        {
          name?: string;
          app?: number;
          derivedAccountId: number;
          d: boolean;
          debug: boolean;
        } & UsageTrackingArgs
      >;
    });

    it('should track command usage', async () => {
      await addAppSecretCommand.handler(args);

      expect(trackCommandUsageMock).toHaveBeenCalledWith(
        'app-secret-add',
        { successful: true },
        123456
      );
    });

    it('should prompt for app selection', async () => {
      await addAppSecretCommand.handler(args);

      expect(selectAppPromptMock).toHaveBeenCalledWith(123456, undefined);
    });

    it('should use provided app ID when specified', async () => {
      args.app = 99999;

      await addAppSecretCommand.handler(args);

      expect(selectAppPromptMock).toHaveBeenCalledWith(123456, 99999);
    });

    it('should error if no app is selected', async () => {
      selectAppPromptMock.mockResolvedValue(null);

      await addAppSecretCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith('');
      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('create a new app')
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(addAppSecretMock).not.toHaveBeenCalled();
    });

    it('should prompt for secret name when not provided', async () => {
      delete args.name;
      secretNamePromptMock.mockResolvedValue({ secretName: 'prompted-name' });

      await addAppSecretCommand.handler(args);

      expect(secretNamePromptMock).toHaveBeenCalledTimes(1);
      expect(addAppSecretMock).toHaveBeenCalledWith(
        123456,
        12345,
        'prompted-name',
        'test-value'
      );
    });

    it('should use provided secret name', async () => {
      await addAppSecretCommand.handler(args);

      expect(secretNamePromptMock).not.toHaveBeenCalled();
      expect(addAppSecretMock).toHaveBeenCalledWith(
        123456,
        12345,
        'test-secret',
        'test-value'
      );
    });

    it('should prompt for secret value', async () => {
      await addAppSecretCommand.handler(args);

      expect(secretValuePromptMock).toHaveBeenCalledTimes(1);
    });

    it('should add app secret successfully', async () => {
      await addAppSecretCommand.handler(args);

      expect(addAppSecretMock).toHaveBeenCalledWith(
        123456,
        12345,
        'test-secret',
        'test-value'
      );
      expect(uiLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('Test App')
      );
      expect(uiLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('test-secret')
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle errors when adding app secret', async () => {
      const error = new Error('API error');
      addAppSecretMock.mockRejectedValue(error);

      await addAppSecretCommand.handler(args);

      expect(logErrorMock).toHaveBeenCalledWith(error);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle errors when selecting app', async () => {
      const error = new Error('App selection error');
      selectAppPromptMock.mockRejectedValue(error);

      await addAppSecretCommand.handler(args);

      expect(logErrorMock).toHaveBeenCalledWith(error);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle errors when prompting for name', async () => {
      delete args.name;
      const error = new Error('Name prompt error');
      secretNamePromptMock.mockRejectedValue(error);

      await addAppSecretCommand.handler(args);

      expect(logErrorMock).toHaveBeenCalledWith(error);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle errors when prompting for value', async () => {
      const error = new Error('Value prompt error');
      secretValuePromptMock.mockRejectedValue(error);

      await addAppSecretCommand.handler(args);

      expect(logErrorMock).toHaveBeenCalledWith(error);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
