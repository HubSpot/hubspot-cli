// @ts-nocheck
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
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
const { logger } = require('@hubspot/local-dev-lib/logger');
const { fetchReleaseData } = require('@hubspot/local-dev-lib/github');

const i18nKey = 'commands.project.subcommands.create';

exports.command = 'create';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  const { derivedAccountId } = options;

  const hasCustomTemplateSource = Boolean(options.templateSource);

  let githubRef = '';

  if (!hasCustomTemplateSource) {
    const releaseData = await fetchReleaseData(
      HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH
    );
    githubRef = releaseData.tag_name;
  }

  const { name, template, dest } = await createProjectPrompt(
    githubRef,
    options
  );

  trackCommandUsage(
    'project-create',
    { type: template.name },
    derivedAccountId
  );

  await createProjectConfig(
    path.resolve(getCwd(), options.dest || dest),
    options.name || name,
    template,
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
    dest: {
      describe: i18n(`${i18nKey}.options.dest.describe`),
      type: 'string',
    },
    template: {
      describe: i18n(`${i18nKey}.options.template.describe`),
      type: 'string',
    },
    'template-source': {
      describe: i18n(`${i18nKey}.options.templateSource.describe`),
      type: 'string',
    },
  });

  yargs.example([['$0 project create', i18n(`${i18nKey}.examples.default`)]]);
  yargs.example([
    [
      '$0 project create --template-source HubSpot/ui-extensions-examples',
      i18n(`${i18nKey}.examples.templateSource`),
    ],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
