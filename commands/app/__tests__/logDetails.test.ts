import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as selectAppPromptLib from '../../../lib/prompts/selectAppPrompt.js';
import * as promptUtilsLib from '../../../lib/prompts/promptUtils.js';
import * as appLogsLib from '../../../lib/app/logs.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import logDetailsCommand, { AppLogDetailsArgs } from '../logDetails.js';

vi.mock('../../../lib/app/logs.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../lib/app/logs.js')
  >('../../../lib/app/logs.js');
  return {
    ...actual,
    handleLogDetailsRequest: vi.fn().mockResolvedValue(undefined),
  };
});
vi.mock('../../../lib/prompts/selectAppPrompt.js');
vi.mock('../../../lib/prompts/promptUtils.js');
vi.mock('../../../lib/commonOpts.js');
vi.mock('../../../lib/errorHandlers/index.js');

// @ts-expect-error process.exit mock does not match the real signature
const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

describe('commands/app/log-details', () => {
  describe('command definition', () => {
    it('should have correct command name', () => {
      expect(logDetailsCommand.command).toBe('log-details <log-id>');
    });

    it('should have a describe property', () => {
      expect(logDetailsCommand.describe).toBeDefined();
      expect(typeof logDetailsCommand.describe).toBe('string');
    });

    it('should have a builder', () => {
      expect(logDetailsCommand.builder).toBeDefined();
    });

    it('should have a handler', () => {
      expect(logDetailsCommand.handler).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should register the type option', () => {
      const optionsSpy = vi.spyOn(yargs as Argv, 'options');
      logDetailsCommand.builder(yargs as Argv);
      const optionsArg = optionsSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(optionsArg).toHaveProperty('type');
    });

    it('should register the logId positional', () => {
      const positionalSpy = vi.spyOn(yargs as Argv, 'positional');
      logDetailsCommand.builder(yargs as Argv);
      expect(positionalSpy).toHaveBeenCalledWith(
        'log-id',
        expect.objectContaining({ type: 'string', demandOption: true })
      );
    });

    it('should register the app and json options', () => {
      const optionsSpy = vi.spyOn(yargs as Argv, 'options');
      logDetailsCommand.builder(yargs as Argv);
      const optionsArg = optionsSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(optionsArg).toHaveProperty('app');
      expect(optionsArg).toHaveProperty('json');
    });
  });

  describe('handler', () => {
    const ACCOUNT_ID = 123456;
    const APP_ID = 789;
    const LOG_ID = 'log-abc-123';
    let args: ArgumentsCamelCase<AppLogDetailsArgs>;

    beforeEach(() => {
      args = {
        derivedAccountId: ACCOUNT_ID,
        app: APP_ID,
        logId: LOG_ID,
        type: 'webhooks',
      } as unknown as ArgumentsCamelCase<AppLogDetailsArgs>;

      vi.mocked(appLogsLib.handleLogDetailsRequest).mockResolvedValue(
        undefined
      );
    });

    it('prompts for type when type is not provided', async () => {
      args.type = undefined;
      vi.mocked(promptUtilsLib.listPrompt).mockResolvedValue('webhooks');

      await logDetailsCommand.handler(args);

      expect(promptUtilsLib.listPrompt).toHaveBeenCalled();
    });

    it('exits with error when type prompt returns nothing', async () => {
      args.type = undefined;
      vi.mocked(promptUtilsLib.listPrompt).mockResolvedValue(
        null as unknown as string
      );

      await logDetailsCommand.handler(args);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('prompts for app when appId is not provided', async () => {
      args.app = undefined;
      vi.mocked(selectAppPromptLib.selectAppPrompt).mockResolvedValue({
        id: APP_ID,
      } as never);

      await logDetailsCommand.handler(args);

      expect(selectAppPromptLib.selectAppPrompt).toHaveBeenCalledWith(
        ACCOUNT_ID
      );
    });

    it('exits with error when no app is selected', async () => {
      args.app = undefined;
      vi.mocked(selectAppPromptLib.selectAppPrompt).mockResolvedValue(null);

      await logDetailsCommand.handler(args);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('calls handleLogDetailsRequest with the correct args', async () => {
      await logDetailsCommand.handler(args);

      expect(appLogsLib.handleLogDetailsRequest).toHaveBeenCalledWith(
        ACCOUNT_ID,
        APP_ID,
        LOG_ID,
        'WEBHOOKS',
        expect.any(Object)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('uses appId from the prompt result when appId is not provided', async () => {
      const promptedAppId = 999;
      args.app = undefined;
      vi.mocked(selectAppPromptLib.selectAppPrompt).mockResolvedValue({
        id: promptedAppId,
      } as never);

      await logDetailsCommand.handler(args);

      expect(appLogsLib.handleLogDetailsRequest).toHaveBeenCalledWith(
        ACCOUNT_ID,
        promptedAppId,
        LOG_ID,
        expect.any(String),
        expect.any(Object)
      );
    });
  });
});
