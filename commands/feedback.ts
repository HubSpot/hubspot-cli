import { Argv, ArgumentsCamelCase } from 'yargs';
import open from 'open';
import { i18n } from '../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import { confirmPrompt, listPrompt } from '../lib/prompts/promptUtils';
import { CommonArgs, YargsCommandModule } from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { EXIT_CODES } from '../lib/enums/exitCodes';

const FEEDBACK_OPTIONS = {
  BUG: 'bug',
  GENERAL: 'general',
};
const FEEDBACK_URLS = {
  BUG: 'https://github.com/HubSpot/hubspot-cli/issues/new',
  GENERAL:
    'https://docs.google.com/forms/d/e/1FAIpQLSejZZewYzuH3oKBU01tseX-cSWOUsTHLTr-YsiMGpzwcvgIMg/viewform?usp=sf_link',
};

const command = 'feedback';
const describe = i18n(`commands.project.subcommands.feedback.describe`);

type FeedbackArgs = CommonArgs & { bug?: boolean; general?: boolean };

async function handler(args: ArgumentsCamelCase<FeedbackArgs>) {
  const { bug: bugFlag, general: generalFlag } = args;
  const usedTypeFlag = bugFlag !== generalFlag;

  await listPrompt(
    i18n(`commands.project.subcommands.feedback.feedbackType.prompt`),
    {
      choices: Object.values(FEEDBACK_OPTIONS).map(option => ({
        name: i18n(
          `commands.project.subcommands.feedback.feedbackType.${option}`
        ),
        value: option,
      })),
      when: !usedTypeFlag,
    }
  );
  const shouldOpen = await confirmPrompt(
    i18n(`commands.project.subcommands.feedback.openPrompt`),
    {
      when: !usedTypeFlag,
    }
  );

  if (shouldOpen || usedTypeFlag) {
    // NOTE: for now, all feedback should go to the hubspot-cli repository
    const url = FEEDBACK_URLS.BUG;
    open(url, { url: true });
    logger.success(
      i18n(`commands.project.subcommands.feedback.success`, { url })
    );
  }
  process.exit(EXIT_CODES.SUCCESS);
}

function feedbackBuilder(yargs: Argv): Argv<FeedbackArgs> {
  yargs.options({
    bug: {
      describe: i18n(
        `commands.project.subcommands.feedback.options.bug.describe`
      ),
      type: 'boolean',
    },
    general: {
      describe: i18n(
        `commands.project.subcommands.feedback.options.general.describe`
      ),
      type: 'boolean',
    },
  });

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
