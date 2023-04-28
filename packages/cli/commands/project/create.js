const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { getCwd } = require('@hubspot/cli-lib/path');
const path = require('path');
const chalk = require('chalk');
const {
  createProjectPrompt,
} = require('../../lib/prompts/createProjectPrompt');
const { createProjectConfig } = require('../../lib/projects');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { uiFeatureHighlight } = require('../../lib/ui');
const { logger } = require('@hubspot/cli-lib/logger');

const i18nKey = 'cli.commands.project.subcommands.create';

exports.command = 'create';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  const { name, template, location } = await createProjectPrompt(options);

  trackCommandUsage('project-create', null, accountId);

  await createProjectConfig(
    path.resolve(getCwd(), options.location || location),
    options.name || name,
    options.template || template
  );

  logger.log('');
  logger.log(chalk.bold(i18n(`${i18nKey}.logs.welcomeMessage`)));
  uiFeatureHighlight([
    'projectUploadCommand',
    'projectDeployCommand',
    'projectHelpCommand',
    'feedbackCommand',
  ]);
};

exports.builder = yargs => {
  yargs.options({
    name: {
      describe: i18n(`${i18nKey}.options.name.describe`),
      type: 'string',
    },
    location: {
      describe: i18n(`${i18nKey}.options.location.describe`),
      type: 'string',
    },
    template: {
      describe: i18n(`${i18nKey}.options.template.describe`),
      type: 'string',
    },
  });

  yargs.example([['$0 project create', i18n(`${i18nKey}.examples.default`)]]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
