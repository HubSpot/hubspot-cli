const { logger } = require('@hubspot/local-dev-lib/logger');
const { getAccountId } = require('@hubspot/local-dev-lib/config');
const { logError } = require('../../lib/errorHandlers/index');
const { fetchReleaseData } = require('@hubspot/local-dev-lib/github');

const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');
const { projectAddPrompt } = require('../../lib/prompts/projectAddPrompt');
const {
  createProjectComponent,
  getProjectComponentsByVersion,
} = require('../../lib/projects');
const { loadAndValidateOptions } = require('../../lib/validation');
const { uiBetaTag } = require('../../lib/ui');
const {
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
} = require('../../lib/constants');

const i18nKey = 'commands.project.subcommands.add';

exports.command = 'add';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  logger.log('');
  logger.log(i18n(`${i18nKey}.creatingComponent.message`));
  logger.log('');

  const accountId = getAccountId(options);

  const releaseData = await fetchReleaseData(
    HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH
  );
  const projectComponentsVersion = releaseData.tag_name;

  const components = await getProjectComponentsByVersion(
    projectComponentsVersion
  );

  let { component, name } = await projectAddPrompt(components, options);

  name = name || options.name;

  if (!component) {
    component = components.find(t => t.path === options.type);
  }

  trackCommandUsage('project-add', null, accountId);

  try {
    await createProjectComponent(component, name, projectComponentsVersion);
    logger.log('');
    logger.log(
      i18n(`${i18nKey}.success.message`, {
        componentName: name,
      })
    );
  } catch (error) {
    logError(error);
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
  yargs.example([
    [
      '$0 project add --name="my-component" --type="components/example-app"',
      i18n(`${i18nKey}.examples.withFlags`),
    ],
  ]);

  return yargs;
};
