// @ts-nocheck
const open = require('open');

const { i18n } = require('../lib/lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { confirmPrompt, listPrompt } = require('../lib/prompts/promptUtils');
const { addGlobalOptions } = require('../lib/commonOpts');

const FEEDBACK_OPTIONS = {
  BUG: 'bug',
  GENERAL: 'general',
};
const FEEDBACK_URLS = {
  BUG: 'https://github.com/HubSpot/hubspot-cli/issues/new',
  GENERAL:
    'https://docs.google.com/forms/d/e/1FAIpQLSejZZewYzuH3oKBU01tseX-cSWOUsTHLTr-YsiMGpzwcvgIMg/viewform?usp=sf_link',
};

exports.command = 'feedback';
exports.describe = i18n(`commands.project.subcommands.feedback.describe`);

exports.handler = async options => {
  const { bug: bugFlag, general: generalFlag } = options;
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
};

exports.builder = yargs => {
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

  addGlobalOptions(yargs);
};
