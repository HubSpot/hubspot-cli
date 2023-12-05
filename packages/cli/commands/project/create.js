const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const path = require('path');
const chalk = require('chalk');
const {
  createProjectPrompt,
} = require('../../lib/prompts/createProjectPrompt');
const { createProjectConfig } = require('../../lib/projects');
const { i18n } = require('../../lib/lang');
const { uiBetaTag, uiFeatureHighlight } = require('../../lib/ui');
const {
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
} = require('../../lib/constants');
const { logger } = require('@hubspot/cli-lib/logger');
const { fetchReleaseData } = require('@hubspot/cli-lib/github');

const i18nKey = 'cli.commands.project.subcommands.create';

exports.command = 'create';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  const hasCustomTemplateSource = Boolean(options.templateSource);

  let githubRef = '';

  if (!hasCustomTemplateSource) {
    const releaseData = await fetchReleaseData(
      HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH
    );
    githubRef = releaseData.tag_name;
  }

  const { name, template, location } = await createProjectPrompt(
    githubRef,
    options
  );

  trackCommandUsage(
    'project-create',
    { type: options.template || template },
    accountId
  );

  await createProjectConfig(
    path.resolve(getCwd(), options.location || location),
    options.name || name,
    template || { path: options.template },
    options.templateSource,
    githubRef
  );

  logger.log('');
  logger.log(chalk.bold(i18n(`${i18nKey}.logs.welcomeMessage`)));
  uiFeatureHighlight([
    'projectDevCommand',
    'projectHelpCommand',
    'feedbackCommand',
    'sampleProjects',
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
    templateSource: {
      describe: i18n(`${i18nKey}.options.templateSource.describe`),
      type: 'string',
    },
  });

  yargs.example([['$0 project create', i18n(`${i18nKey}.examples.default`)]]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
