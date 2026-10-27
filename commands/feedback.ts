import { Argv, ArgumentsCamelCase } from 'yargs';
import open from 'open';
import { confirmPrompt } from '../lib/prompts/promptUtils.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../types/Yargs.js';
import { makeWrappedYargsHandler } from '../lib/yargs/makeWrappedYargsHandler.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import { commands } from '../lang/en.js';
import { uiLogger } from '../lib/ui/logger.js';
import { ApiErrorContext, logError } from '../lib/errorHandlers/index.js';
import {
  FEEDBACK_SOURCE_ENV_VAR,
  FEEDBACK_URL,
  MAX_FEEDBACK_LENGTH,
} from '../lib/constants.js';
import { FEEDBACK_SOURCES, FeedbackSource } from '../api/feedback.js';
import { containsAccountCredentials, submitFeedback } from '../lib/feedback.js';

const command = 'feedback';
const describe = commands.project.feedback.describe;

type FeedbackArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & {
    message?: string;
    source: FeedbackSource;
  };

async function handler(args: ArgumentsCamelCase<FeedbackArgs>): Promise<void> {
  const { message, source, derivedAccountId, addUsageMetadata, exit } = args;

  if (message === undefined) {
    if (!process.stdin.isTTY) {
      uiLogger.log(commands.project.feedback.nonInteractive(FEEDBACK_URL));
      return exit(EXIT_CODES.SUCCESS);
    }

    const shouldOpen = await confirmPrompt(
      commands.project.feedback.openPrompt
    );

    if (!shouldOpen) {
      uiLogger.log(commands.project.feedback.error(FEEDBACK_URL));
      return exit(EXIT_CODES.SUCCESS);
    }

    addUsageMetadata({ action: 'open-form' });
    open(FEEDBACK_URL, { url: true });
    uiLogger.success(commands.project.feedback.success(FEEDBACK_URL));

    return exit(EXIT_CODES.SUCCESS);
  }

  addUsageMetadata({ action: 'submit', type: source });

  const feedback = message.trim();

  if (!feedback) {
    uiLogger.error(commands.project.feedback.errors.blankMessage);
    return exit(EXIT_CODES.ERROR);
  }

  if (feedback.length > MAX_FEEDBACK_LENGTH) {
    uiLogger.error(
      commands.project.feedback.errors.messageTooLong(feedback.length)
    );
    return exit(EXIT_CODES.ERROR);
  }

  if (!derivedAccountId) {
    uiLogger.error(commands.project.feedback.errors.noAccount);
    return exit(EXIT_CODES.ERROR);
  }

  if (containsAccountCredentials(feedback)) {
    uiLogger.error(commands.project.feedback.errors.containsCredentials);
    return exit(EXIT_CODES.ERROR);
  }

  try {
    await submitFeedback(derivedAccountId, feedback, source);
  } catch (error) {
    uiLogger.error(commands.project.feedback.errors.submitFailed);
    logError(
      error,
      new ApiErrorContext({
        accountId: derivedAccountId,
        request: 'submit feedback',
      })
    );
    return exit(EXIT_CODES.ERROR);
  }

  uiLogger.success(commands.project.feedback.submitSuccess);
  return exit(EXIT_CODES.SUCCESS);
}

function feedbackBuilder(yargs: Argv): Argv<FeedbackArgs> {
  yargs.options({
    message: {
      alias: 'm',
      describe: commands.project.feedback.options.message.describe,
      type: 'string',
    },
    source: {
      describe: commands.project.feedback.options.source.describe,
      type: 'string',
      choices: FEEDBACK_SOURCES,
      default:
        process.env[FEEDBACK_SOURCE_ENV_VAR]?.trim().toLowerCase() || undefined,
    },
  });

  yargs.check(argv => {
    if (argv.message !== undefined && !argv.source) {
      throw new Error(commands.project.feedback.errors.sourceRequired);
    }
    return true;
  });

  yargs.example([
    ['$0 feedback', commands.project.feedback.examples.openForm],
    [
      '$0 feedback --message "<message>" --source=user',
      commands.project.feedback.examples.submit,
    ],
    [
      '$0 feedback --message "<message>" --source=agent',
      commands.project.feedback.examples.submitAsAgent,
    ],
  ]);

  return yargs as Argv<FeedbackArgs>;
}

const builder = makeYargsBuilder<FeedbackArgs>(
  feedbackBuilder,
  command,
  commands.project.feedback.verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const feedbackCommand: YargsCommandModule<unknown, FeedbackArgs> = {
  command,
  describe,
  handler: makeWrappedYargsHandler('feedback', handler),
  builder,
};

export default feedbackCommand;
