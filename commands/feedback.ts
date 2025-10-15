import { Argv } from 'yargs';
import open from 'open';
import { confirmPrompt } from '../lib/prompts/promptUtils.js';
import { CommonArgs, YargsCommandModule } from '../types/Yargs.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import { commands } from '../lang/en.js';
import { uiLogger } from '../lib/ui/logger.js';

const FEEDBACK_URL = 'https://developers.hubspot.com/feedback';

const command = 'feedback';
const describe = commands.project.feedback.describe;

type FeedbackArgs = CommonArgs;

async function handler() {
  const shouldOpen = await confirmPrompt(commands.project.feedback.openPrompt);

  if (!shouldOpen) {
    uiLogger.log(commands.project.feedback.error(FEEDBACK_URL));
    process.exit(EXIT_CODES.SUCCESS);
  }

  open(FEEDBACK_URL, { url: true });
  uiLogger.success(commands.project.feedback.success(FEEDBACK_URL));

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
