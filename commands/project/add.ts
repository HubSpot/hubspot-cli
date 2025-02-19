// @ts-nocheck
const path = require('path');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  cloneGithubRepo,
  fetchReleaseData,
} = require('@hubspot/local-dev-lib/github');
const { debugError } = require('../../lib/errorHandlers');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');
const { projectAddPrompt } = require('../../lib/prompts/projectAddPrompt');
const { getProjectConfig } = require('../../lib/projects');
const {
  getProjectComponentListFromRepo,
} = require('../../lib/projects/create');
const { findProjectComponents } = require('../../lib/projects/structure');
const { ComponentTypes } = require('../../types/Projects');
const { uiBetaTag } = require('../../lib/ui');
const {
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
} = require('../../lib/constants');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'commands.project.subcommands.add';

exports.command = 'add';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  const { derivedAccountId } = options;

  trackCommandUsage('project-add', null, derivedAccountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  if (!projectDir || !projectConfig) {
    logger.error(i18n(`${i18nKey}.error.locationInProject`));
    process.exit(EXIT_CODES.ERROR);
  }

  // We currently only support adding private apps to projects
  let projectContainsPublicApp = false;
  try {
    const components = await findProjectComponents(projectDir);
    projectContainsPublicApp = components.some(
      c => c.type === ComponentTypes.PublicApp
    );
  } catch (err) {
    debugError(err);
  }

  if (projectContainsPublicApp) {
    logger.error(i18n(`${i18nKey}.error.projectContainsPublicApp`));
    process.exit(EXIT_CODES.ERROR);
  }

  logger.log('');
  logger.log(
    i18n(`${i18nKey}.creatingComponent`, {
      projectName: projectConfig.name,
    })
  );
  logger.log('');

  let latestRepoReleaseTag;
  try {
    // We want the tag_name from the latest release of the components repo
    const repoReleaseData = await fetchReleaseData(
      HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH
    );
    if (repoReleaseData) {
      latestRepoReleaseTag = repoReleaseData.tag_name;
    }
  } catch (err) {
    debugError(err);
    logger.error(i18n(`${i18nKey}.error.failedToFetchComponentList`));
    process.exit(EXIT_CODES.ERROR);
  }

  const components =
    await getProjectComponentListFromRepo(latestRepoReleaseTag);

  if (!components.length) {
    logger.error(i18n(`${i18nKey}.error.failedToFetchComponentList`));
    process.exit(EXIT_CODES.ERROR);
  }

  const { componentData, name } = await projectAddPrompt(components, options);
  const componentName = name || options.name;

  try {
    const componentPath = path.join(
      projectDir,
      projectConfig.srcDir,
      componentData.insertPath,
      componentName
    );

    await cloneGithubRepo(
      HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
      componentPath,
      {
        sourceDir: componentData.path,
        tag: latestRepoReleaseTag,
        hideLogs: true,
      }
    );

    logger.log('');
    logger.success(i18n(`${i18nKey}.success`, { componentName }));
  } catch (error) {
    debugError(error);
    logger.error(i18n(`${i18nKey}.error.failedToDownloadComponent`));
    process.exit(EXIT_CODES.ERROR);
  }
  process.exit(EXIT_CODES.SUCCESS);
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
