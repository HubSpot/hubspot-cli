const open = require('open');

const { i18n } = require('@hubspot/cli-lib/lib/lang');
const {
  FEEDBACK_OPTIONS,
  FEEDBACK_URLS,
} = require('@hubspot/cli-lib/lib/constants');
const { logger } = require('@hubspot/cli-lib/logger');

const {
  feedbackTypePrompt,
  bugPrompt,
  generalPrompt,
} = require('../lib/prompts/feedbackPrompt');

const i18nKey = 'cli.commands.project.subcommands.feedback';

exports.command = 'feedback';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async () => {
  const { type } = await feedbackTypePrompt();

  const promptForType =
    type === FEEDBACK_OPTIONS.BUG ? bugPrompt : generalPrompt;
  const { shouldOpen } = await promptForType();

  if (shouldOpen === 'Y') {
    const url =
      type === FEEDBACK_OPTIONS.BUG ? FEEDBACK_URLS.BUG : FEEDBACK_URLS.GENERAL;
    open(url, { url: true });
    logger.success(i18n(`${i18nKey}.success`, { url }));
  }
};
