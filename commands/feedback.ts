import { Argv } from 'yargs';
import open from 'open';
import { i18n } from '../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import { confirmPrompt } from '../lib/prompts/promptUtils';
import { CommonArgs, YargsCommandModule } from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import { uiLink } from '../lib/ui';
const FEEDBACK_URL = 'https://developers.hubspot.com/feedback';

const command = 'feedback';
const describe = i18n(`commands.project.subcommands.feedback.describe`);

type FeedbackArgs = CommonArgs;

async function handler() {
  const shouldOpen = await confirmPrompt(
    i18n(`commands.project.subcommands.feedback.openPrompt`)
  );

  if (!shouldOpen) {
    logger.log(
      i18n(`commands.project.subcommands.feedback.error`, {
        url: uiLink('the developer feedback form', FEEDBACK_URL),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  open(FEEDBACK_URL, { url: true });
  logger.success(
    i18n(`commands.project.subcommands.feedback.success`, {
      url: uiLink('the developer feedback form', FEEDBACK_URL),
    })
  );

  process.exit(EXIT_CODES.SUCCESS);
}

function feedbackBuilder(yargs: Argv): Argv<FeedbackArgs> {
  return yargs as Argv<FeedbackArgs>;
}

const builder = makeYargsBuilder<FeedbackArgs>(
  feedbackBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const feedbackCommand: YargsCommandModule<unknown, FeedbackArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default feedbackCommand;

// TODO remove this after cli.ts is ported to TS
module.exports = feedbackCommand;
