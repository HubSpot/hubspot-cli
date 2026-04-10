import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import { addSecret, fetchSecrets } from '@hubspot/local-dev-lib/api/secrets';
import {
  secretNamePrompt,
  secretValuePrompt,
} from '../../../lib/prompts/secretPrompt.js';
import { logError, ApiErrorContext } from '../../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import type { UsageTrackingArgs } from '../../../types/Yargs.js';
import addSecretCommand from '../addSecret.js';

vi.mock('../../../lib/commonOpts');
vi.mock('@hubspot/local-dev-lib/api/secrets');
vi.mock('../../../lib/prompts/secretPrompt.js');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('@hubspot/local-dev-lib/config');

const addSecretMock = vi.mocked(addSecret);
const fetchSecretsMock = vi.mocked(fetchSecrets);
const secretNamePromptMock = vi.mocked(secretNamePrompt);
const secretValuePromptMock = vi.mocked(secretValuePrompt);
const logErrorMock = vi.mocked(logError);
const processExitSpy = vi.spyOn(process, 'exit');

describe('commands/secret/addSecret', () => {
  const yargsMock = yargs as Argv;
  const uiLogger = global.mockUiLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    fetchSecretsMock.mockResolvedValue({
      data: { results: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      // @ts-expect-error
      config: {},
    });
    secretValuePromptMock.mockResolvedValue({ secretValue: 'test-value' });
    // @ts-expect-error
    addSecretMock.mockResolvedValue(undefined);
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(addSecretCommand.command).toEqual('add [name]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(addSecretCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      addSecretCommand.builder(yargsMock);

      expect(yargsMock.positional).toHaveBeenCalledTimes(1);
      expect(yargsMock.positional).toHaveBeenCalledWith(
        'name',
        expect.objectContaining({ type: 'string' })
      );
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<
      {
        name?: string;
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
      } as unknown as ArgumentsCamelCase<
        {
          name?: string;
          derivedAccountId: number;
          d: boolean;
          debug: boolean;
        } & UsageTrackingArgs
      >;
    });

    it('should track command usage', async () => {
      await addSecretCommand.handler(args);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should prompt for secret name when not provided', async () => {
      delete args.name;
      secretNamePromptMock.mockResolvedValue({ secretName: 'prompted-name' });

      await addSecretCommand.handler(args);

      expect(secretNamePromptMock).toHaveBeenCalledTimes(1);
      expect(addSecretMock).toHaveBeenCalledWith(
        123456,
        'prompted-name',
        'test-value'
      );
    });

    it('should use provided secret name', async () => {
      await addSecretCommand.handler(args);

      expect(secretNamePromptMock).not.toHaveBeenCalled();
      expect(addSecretMock).toHaveBeenCalledWith(
        123456,
        'test-secret',
        'test-value'
      );
    });

    it('should fetch existing secrets to check for duplicates', async () => {
      await addSecretCommand.handler(args);

      expect(fetchSecretsMock).toHaveBeenCalledWith(123456);
    });

    it('should error and exit if secret already exists', async () => {
      fetchSecretsMock.mockResolvedValue({
        data: { results: ['test-secret', 'other-secret'] },
        status: 200,
        statusText: 'OK',
        headers: {},
        // @ts-expect-error
        config: {},
      });

      await addSecretCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('test-secret')
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(addSecretMock).not.toHaveBeenCalled();
    });

    it('should allow adding secret if name does not exist', async () => {
      fetchSecretsMock.mockResolvedValue({
        data: { results: ['other-secret', 'another-secret'] },
        status: 200,
        statusText: 'OK',
        headers: {},
        // @ts-expect-error
        config: {},
      });
      // @ts-expect-error doesn't matter
      addSecretMock.mockResolvedValue(undefined);

      await addSecretCommand.handler(args);

      expect(addSecretMock).toHaveBeenCalledWith(
        123456,
        'test-secret',
        'test-value'
      );

      expect(uiLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('test-secret')
      );
    });

    it('should prompt for secret value', async () => {
      await addSecretCommand.handler(args);

      expect(secretValuePromptMock).toHaveBeenCalledTimes(1);
    });

    it('should add secret successfully', async () => {
      // @ts-expect-error doesn't matter
      addSecretMock.mockResolvedValue(undefined);

      await addSecretCommand.handler(args);

      expect(addSecretMock).toHaveBeenCalledWith(
        123456,
        'test-secret',
        'test-value'
      );
      expect(uiLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('test-secret')
      );
      expect(uiLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('123456')
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle errors when adding secret', async () => {
      const error = new Error('API error');
      addSecretMock.mockRejectedValueOnce(error);

      await addSecretCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('test-secret')
      );
      expect(logErrorMock).toHaveBeenCalledWith(
        error,
        expect.any(ApiErrorContext)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle errors when fetching existing secrets', async () => {
      const error = new Error('Fetch error');
      fetchSecretsMock.mockRejectedValueOnce(error);

      await addSecretCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalled();
      expect(logErrorMock).toHaveBeenCalledWith(
        error,
        expect.any(ApiErrorContext)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle errors when prompting for name', async () => {
      delete args.name;
      const error = new Error('Prompt error');
      secretNamePromptMock.mockRejectedValueOnce(error);

      await addSecretCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalled();
      expect(logErrorMock).toHaveBeenCalledWith(
        error,
        expect.any(ApiErrorContext)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle errors when prompting for value', async () => {
      const error = new Error('Value prompt error');
      secretValuePromptMock.mockRejectedValueOnce(error);

      await addSecretCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalled();
      expect(logErrorMock).toHaveBeenCalledWith(
        error,
        expect.any(ApiErrorContext)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
