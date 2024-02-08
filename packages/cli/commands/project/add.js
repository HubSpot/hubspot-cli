const { logger } = require('@hubspot/cli-lib/logger');
const { getAccountId } = require('@hubspot/local-dev-lib/config');
const { logErrorInstance } = require('../../lib/errorHandlers/standardErrors');
const { fetchReleaseData } = require('@hubspot/cli-lib/github');

const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');
const { projectAddPrompt } = require('../../lib/prompts/projectAddPrompt');
const { createProjectComponent } = require('../../lib/projects');
const { loadAndValidateOptions } = require('../../lib/validation');
const { uiBetaTag } = require('../../lib/ui');
const {
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
} = require('../../lib/constants');

const i18nKey = 'cli.commands.project.subcommands.add';

exports.command = 'add';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  logger.log('');
  logger.log(i18n(`${i18nKey}.creatingComponent.message`));
  logger.log('');

  const releaseData = await fetchReleaseData(
    HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH
  );
  const projectComponentsVersion = releaseData.tag_name;

  const { type, name } = await projectAddPrompt(
    projectComponentsVersion,
    options
  );

  trackCommandUsage('project-add', null, accountId);

  try {
    await createProjectComponent(
      options.type || type,
      options.name || name,
      projectComponentsVersion
    );
    logger.log('');
    logger.log(
      i18n(`${i18nKey}.success.message`, {
        componentName: options.name || name,
      })
    );
  } catch (error) {
    logErrorInstance(error);
  }
};

exports.builder = yargs => {
  yargs.options({
    type: {
      describe: i18n(`${i18nKey}.options.type.describe`),
      type: 'string',
    },
    name: {
      describe: i18n(`${i18nKey}.options.name.describe`),
      type: 'string',
    },
  });

  yargs.example([['$0 project add', i18n(`${i18nKey}.examples.default`)]]);

  return yargs;
};
