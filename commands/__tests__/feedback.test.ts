import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import open from 'open';
import * as commonOpts from '../../lib/commonOpts.js';
import { confirmPrompt } from '../../lib/prompts/promptUtils.js';
import {
  containsAccountCredentials,
  submitFeedback,
} from '../../lib/feedback.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  FEEDBACK_SOURCE_ENV_VAR,
  FEEDBACK_URL,
  MAX_FEEDBACK_LENGTH,
} from '../../lib/constants.js';
import { commands } from '../../lang/en.js';
import type { UsageTrackingArgs } from '../../types/Yargs.js';
import feedbackCommand from '../feedback.js';

vi.mock('../../lib/commonOpts');
vi.mock('../../lib/prompts/promptUtils');
vi.mock('../../lib/errorHandlers/index.js');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('open');
vi.mock('../../lib/feedback.js');

const confirmPromptMock = vi.mocked(confirmPrompt);
const submitFeedbackMock = vi.mocked(submitFeedback);
const containsAccountCredentialsMock = vi.mocked(containsAccountCredentials);
const logErrorMock = vi.mocked(logError);
const openMock = vi.mocked(open);
const processExitSpy = vi.spyOn(process, 'exit');

type FeedbackTestArgs = ArgumentsCamelCase<
  {
    message?: string;
    source: 'user' | 'agent';
    derivedAccountId: number;
    d: boolean;
    debug: boolean;
  } & UsageTrackingArgs
>;

describe('commands/feedback', () => {
  const yargsMock = yargs as Argv;
  const uiLogger = global.mockUiLogger;

  beforeEach(() => {
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    submitFeedbackMock.mockResolvedValue(undefined);
    containsAccountCredentialsMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(feedbackCommand.command).toEqual('feedback');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(feedbackCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      feedbackCommand.builder(yargsMock);

      expect(commonOpts.addGlobalOptions).toHaveBeenCalledWith(yargsMock);
      expect(commonOpts.addConfigOptions).toHaveBeenCalledWith(yargsMock);
      expect(commonOpts.addAccountOptions).toHaveBeenCalledWith(yargsMock);
      expect(commonOpts.addUseEnvironmentOptions).toHaveBeenCalledWith(
        yargsMock
      );

      expect(yargsMock.options).toHaveBeenCalledWith({
        message: expect.objectContaining({ alias: 'm', type: 'string' }),
        source: expect.objectContaining({
          type: 'string',
          choices: ['user', 'agent'],
          default: undefined,
        }),
      });
    });

    it('should require --source with --message', () => {
      feedbackCommand.builder(yargsMock);
      const checkFn: (argv: Record<string, unknown>) => boolean =
        global.mockYargs.check.mock.calls[0][0];

      expect(() => checkFn({ message: 'hi' })).toThrow(
        commands.project.feedback.errors.sourceRequired
      );
      expect(checkFn({ message: 'hi', source: 'agent' })).toBe(true);
      expect(checkFn({})).toBe(true);
    });

    it('should default --source to the normalized environment variable', () => {
      vi.stubEnv(FEEDBACK_SOURCE_ENV_VAR, ' AGENT ');

      feedbackCommand.builder(yargsMock);

      expect(yargsMock.options).toHaveBeenCalledWith(
        expect.objectContaining({
          source: expect.objectContaining({ default: 'agent' }),
        })
      );
    });
  });

  describe('handler', () => {
    let args: FeedbackTestArgs;
    const originalIsTTY = process.stdin.isTTY;

    beforeEach(() => {
      process.stdin.isTTY = true;
      args = {
        source: 'user',
        derivedAccountId: 123456,
        d: false,
        debug: false,
      } as unknown as FeedbackTestArgs;
    });

    afterEach(() => {
      process.stdin.isTTY = originalIsTTY;
    });

    describe('without a message', () => {
      it('should open the feedback form when the user confirms', async () => {
        confirmPromptMock.mockResolvedValue(true);

        await feedbackCommand.handler(args);

        expect(confirmPromptMock).toHaveBeenCalledWith(
          commands.project.feedback.openPrompt
        );
        expect(openMock).toHaveBeenCalledWith(FEEDBACK_URL, { url: true });
        expect(uiLogger.success).toHaveBeenCalledWith(
          commands.project.feedback.success(FEEDBACK_URL)
        );
        expect(submitFeedbackMock).not.toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      });

      it('should log how to send feedback without prompting when stdin is not a terminal', async () => {
        process.stdin.isTTY = false;

        await feedbackCommand.handler(args);

        expect(confirmPromptMock).not.toHaveBeenCalled();
        expect(openMock).not.toHaveBeenCalled();
        expect(uiLogger.log).toHaveBeenCalledWith(
          commands.project.feedback.nonInteractive(FEEDBACK_URL)
        );
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      });

      it('should log the feedback form URL when the user declines', async () => {
        confirmPromptMock.mockResolvedValue(false);

        await feedbackCommand.handler(args);

        expect(openMock).not.toHaveBeenCalled();
        expect(uiLogger.log).toHaveBeenCalledWith(
          commands.project.feedback.error(FEEDBACK_URL)
        );
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      });
    });

    describe('with a message', () => {
      beforeEach(() => {
        args.message = 'Great tool';
      });

      it('should submit the feedback without prompting or opening a browser', async () => {
        await feedbackCommand.handler(args);

        expect(confirmPromptMock).not.toHaveBeenCalled();
        expect(openMock).not.toHaveBeenCalled();
        expect(submitFeedbackMock).toHaveBeenCalledWith(
          123456,
          'Great tool',
          'user'
        );
        expect(uiLogger.success).toHaveBeenCalledWith(
          commands.project.feedback.submitSuccess
        );
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      });

      it('should trim the message before submitting', async () => {
        args.message = '  Great tool \n';

        await feedbackCommand.handler(args);

        expect(submitFeedbackMock).toHaveBeenCalledWith(
          123456,
          'Great tool',
          'user'
        );
      });

      it('should submit with the given source', async () => {
        args.source = 'agent';

        await feedbackCommand.handler(args);

        expect(submitFeedbackMock).toHaveBeenCalledWith(
          123456,
          args.message,
          'agent'
        );
      });

      it.each(['', '   ', ' \n\t '])(
        'should reject a blank message (%j)',
        async blankMessage => {
          args.message = blankMessage;

          await feedbackCommand.handler(args);

          expect(uiLogger.error).toHaveBeenCalledWith(
            commands.project.feedback.errors.blankMessage
          );
          expect(confirmPromptMock).not.toHaveBeenCalled();
          expect(submitFeedbackMock).not.toHaveBeenCalled();
          expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        }
      );

      it('should accept a message at the max length', async () => {
        args.message = 'a'.repeat(MAX_FEEDBACK_LENGTH);

        await feedbackCommand.handler(args);

        expect(submitFeedbackMock).toHaveBeenCalledTimes(1);
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      });

      it('should reject a message over the max length', async () => {
        args.message = 'a'.repeat(MAX_FEEDBACK_LENGTH + 1);

        await feedbackCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalledWith(
          commands.project.feedback.errors.messageTooLong(
            MAX_FEEDBACK_LENGTH + 1
          )
        );
        expect(submitFeedbackMock).not.toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });

      it('should reject a message that contains account credentials', async () => {
        containsAccountCredentialsMock.mockReturnValue(true);

        await feedbackCommand.handler(args);

        expect(containsAccountCredentialsMock).toHaveBeenCalledWith(
          'Great tool'
        );
        expect(uiLogger.error).toHaveBeenCalledWith(
          commands.project.feedback.errors.containsCredentials
        );
        expect(submitFeedbackMock).not.toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });

      it('should error when no account is configured', async () => {
        args = {
          ...args,
          derivedAccountId: undefined,
        } as unknown as FeedbackTestArgs;

        await feedbackCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalledWith(
          commands.project.feedback.errors.noAccount
        );
        expect(submitFeedbackMock).not.toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });

      it('should log the error and exit when the request fails', async () => {
        const error = new Error('Request failed');
        submitFeedbackMock.mockRejectedValue(error);

        await feedbackCommand.handler(args);

        expect(logErrorMock).toHaveBeenCalledWith(error, expect.anything());
        expect(uiLogger.error).toHaveBeenCalledWith(
          commands.project.feedback.errors.submitFailed
        );
        expect(uiLogger.success).not.toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });
    });
  });
});
