import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as selectAppPromptLib from '../../../lib/prompts/selectAppPrompt.js';
import * as promptUtilsLib from '../../../lib/prompts/promptUtils.js';
import * as appLogsLib from '../../../lib/app/logs.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import logsCommand, { AppLogsArgs } from '../logs.js';
import {
  parseSinceTime,
  SYSTEM_TYPE_DISPLAY_NAMES,
} from '../../../lib/app/logs.js';

vi.mock('../../../lib/app/logs.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../lib/app/logs.js')
  >('../../../lib/app/logs.js');
  return {
    ...actual,
    handleLogsRequest: vi.fn().mockResolvedValue(undefined),
    tailAppLogs: vi.fn().mockResolvedValue(undefined),
  };
});
vi.mock('../../../lib/prompts/selectAppPrompt.js');
vi.mock('../../../lib/prompts/promptUtils.js');
vi.mock('../../../lib/commonOpts.js');
vi.mock('../../../lib/errorHandlers/index.js');

// @ts-expect-error process.exit mock does not match the real signature
const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

describe('commands/app/logs', () => {
  describe('command definition', () => {
    it('should have correct command name', () => {
      expect(logsCommand.command).toBe('logs');
    });

    it('should have a describe property', () => {
      expect(logsCommand.describe).toBeDefined();
      expect(typeof logsCommand.describe).toBe('string');
    });

    it('should have a builder', () => {
      expect(logsCommand.builder).toBeDefined();
    });

    it('should have a handler', () => {
      expect(logsCommand.handler).toBeDefined();
    });
  });

  describe('SYSTEM_TYPE_DISPLAY_NAMES', () => {
    it('should not include UNDEFINED', () => {
      expect(SYSTEM_TYPE_DISPLAY_NAMES).not.toHaveProperty('UNDEFINED');
    });

    it('should include all expected system types', () => {
      expect(SYSTEM_TYPE_DISPLAY_NAMES).toHaveProperty('WEBHOOKS');
      expect(SYSTEM_TYPE_DISPLAY_NAMES).toHaveProperty('API_CALL');
      expect(SYSTEM_TYPE_DISPLAY_NAMES).toHaveProperty('SERVERLESS_EXECUTION');
      expect(SYSTEM_TYPE_DISPLAY_NAMES).toHaveProperty(
        'CRM_EXTENSIBILITY_CARD'
      );
      expect(SYSTEM_TYPE_DISPLAY_NAMES).toHaveProperty('OAUTH_AUTHORIZATION');
    });
  });

  describe('parseSinceTime', () => {
    it('should parse relative time in minutes', () => {
      const result = parseSinceTime('30m');
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.endTime - result.startTime).toBeGreaterThan(29 * 60 * 1000);
      expect(result.endTime - result.startTime).toBeLessThan(31 * 60 * 1000);
    });

    it('should parse relative time in hours', () => {
      const result = parseSinceTime('1h');
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.endTime - result.startTime).toBeGreaterThan(59 * 60 * 1000);
      expect(result.endTime - result.startTime).toBeLessThan(61 * 60 * 1000);
    });

    it('should parse relative time in days', () => {
      const result = parseSinceTime('2d');
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.endTime - result.startTime).toBeGreaterThan(
        2 * 24 * 60 * 60 * 1000 - 1000
      );
      expect(result.endTime - result.startTime).toBeLessThan(
        2 * 24 * 60 * 60 * 1000 + 1000
      );
    });

    it('should parse ISO timestamps', () => {
      const isoTime = '2026-04-16T10:00:00Z';
      const result = parseSinceTime(isoTime);
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.startTime).toBe(new Date(isoTime).getTime());
    });

    it('should throw error for invalid format', () => {
      expect(() => parseSinceTime('invalid')).toThrow();
      expect(() => parseSinceTime('10x')).toThrow();
      expect(() => parseSinceTime('')).toThrow();
    });
  });

  describe('builder', () => {
    it('should register the type option', () => {
      const optionsSpy = vi.spyOn(yargs as Argv, 'options');
      logsCommand.builder(yargs as Argv);
      const optionsArg = optionsSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(optionsArg).toHaveProperty('type');
    });

    it('should register the app option', () => {
      const optionsSpy = vi.spyOn(yargs as Argv, 'options');
      logsCommand.builder(yargs as Argv);
      const optionsArg = optionsSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(optionsArg).toHaveProperty('app');
    });
  });

  describe('handler', () => {
    const ACCOUNT_ID = 123456;
    const APP_ID = 789;
    let args: ArgumentsCamelCase<AppLogsArgs>;

    beforeEach(() => {
      args = {
        derivedAccountId: ACCOUNT_ID,
        app: APP_ID,
        type: 'webhooks',
        tail: false,
      } as unknown as ArgumentsCamelCase<AppLogsArgs>;

      vi.mocked(appLogsLib.handleLogsRequest).mockResolvedValue(undefined);
      vi.mocked(appLogsLib.tailAppLogs).mockResolvedValue(undefined);
    });

    it('prompts for type when type is not provided', async () => {
      args.type = undefined;
      vi.mocked(promptUtilsLib.listPrompt).mockResolvedValue('webhooks');

      await logsCommand.handler(args);

      expect(promptUtilsLib.listPrompt).toHaveBeenCalled();
    });

    it('exits with error when type prompt returns nothing', async () => {
      args.type = undefined;
      vi.mocked(promptUtilsLib.listPrompt).mockResolvedValue(
        null as unknown as string
      );

      await logsCommand.handler(args);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('prompts for app when appId is not provided', async () => {
      args.app = undefined;
      vi.mocked(selectAppPromptLib.selectAppPrompt).mockResolvedValue({
        id: APP_ID,
      } as never);

      await logsCommand.handler(args);

      expect(selectAppPromptLib.selectAppPrompt).toHaveBeenCalledWith(
        ACCOUNT_ID
      );
    });

    it('exits with error when no app is selected', async () => {
      args.app = undefined;
      vi.mocked(selectAppPromptLib.selectAppPrompt).mockResolvedValue(null);

      await logsCommand.handler(args);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('calls handleLogsRequest with the resolved systemType and appId', async () => {
      await logsCommand.handler(args);

      expect(appLogsLib.handleLogsRequest).toHaveBeenCalledWith(
        ACCOUNT_ID,
        APP_ID,
        'WEBHOOKS',
        expect.any(Object)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('calls tailAppLogs instead of handleLogsRequest when tail is set', async () => {
      args.tail = true;

      await logsCommand.handler(args);

      expect(appLogsLib.tailAppLogs).toHaveBeenCalledWith(
        ACCOUNT_ID,
        APP_ID,
        'WEBHOOKS',
        expect.any(Object)
      );
      expect(appLogsLib.handleLogsRequest).not.toHaveBeenCalled();
    });

    it('uses the appId from the prompt result', async () => {
      const promptedAppId = 999;
      args.app = undefined;
      vi.mocked(selectAppPromptLib.selectAppPrompt).mockResolvedValue({
        id: promptedAppId,
      } as never);

      await logsCommand.handler(args);

      expect(appLogsLib.handleLogsRequest).toHaveBeenCalledWith(
        ACCOUNT_ID,
        promptedAppId,
        expect.any(String),
        expect.any(Object)
      );
    });
  });
});
