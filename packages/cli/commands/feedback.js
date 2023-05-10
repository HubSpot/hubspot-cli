const open = require('open');

const { i18n } = require('../lib/lang');
const {
  FEEDBACK_OPTIONS,
  FEEDBACK_URLS,
} = require('@hubspot/cli-lib/lib/constants');
const { logger } = require('@hubspot/cli-lib/logger');

const {
  feedbackTypePrompt,
  shouldOpenBrowserPrompt,
} = require('../lib/prompts/feedbackPrompt');

const i18nKey = 'cli.commands.project.subcommands.feedback';

exports.command = 'feedback';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { bug: bugFlag, general: generalFlag } = options;
  const usedTypeFlag = bugFlag !== generalFlag;

  const { type } = await feedbackTypePrompt(usedTypeFlag);
  const { shouldOpen } = await shouldOpenBrowserPrompt(type, usedTypeFlag);

  if (shouldOpen || usedTypeFlag) {
    const url =
      type === FEEDBACK_OPTIONS.BUG || bugFlag
        ? FEEDBACK_URLS.BUG
        : FEEDBACK_URLS.GENERAL;
    open(url, { url: true });
    logger.success(i18n(`${i18nKey}.success`, { url }));
  }
};

exports.builder = yargs => {
  yargs.options({
    bug: {
      describe: i18n(`${i18nKey}.options.bug.describe`),
      type: 'boolean',
    },
    general: {
      describe: i18n(`${i18nKey}.options.general.describe`),
      type: 'boolean',
    },
  });
};
