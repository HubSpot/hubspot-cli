// @ts-nocheck
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  fetchReleaseData,
  cloneGithubRepo,
} = require('@hubspot/local-dev-lib/github');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  createProjectPrompt,
} = require('../../lib/prompts/createProjectPrompt');
const { writeProjectConfig, getProjectConfig } = require('../../lib/projects');
const {
  getProjectTemplateListFromRepo,
  EMPTY_PROJECT_TEMPLATE_NAME,
} = require('../../lib/projects/create');
const { i18n } = require('../../lib/lang');
const { uiBetaTag, uiFeatureHighlight } = require('../../lib/ui');
const { debugError } = require('../../lib/errorHandlers');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const {
  PROJECT_CONFIG_FILE,
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  DEFAULT_PROJECT_TEMPLATE_BRANCH,
} = require('../../lib/constants');

const i18nKey = 'commands.project.subcommands.create';

exports.command = 'create';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  const { derivedAccountId } = options;

  let latestRepoReleaseTag;
  let templateSource = options.templateSource;
  if (!templateSource) {
    templateSource = HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH;
    try {
      const releaseData = await fetchReleaseData(
        HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH
      );
      if (releaseData) {
        latestRepoReleaseTag = releaseData.tag_name;
      }
    } catch (err) {
      logger.error(i18n(`${i18nKey}.error.failedToFetchProjectList`));
      process.exit(EXIT_CODES.ERROR);
    }
  }

  const projectTemplates = await getProjectTemplateListFromRepo(
    templateSource,
    latestRepoReleaseTag || DEFAULT_PROJECT_TEMPLATE_BRANCH
  );

  if (!projectTemplates.length) {
    logger.error(i18n(`${i18nKey}.error.failedToFetchProjectList`));
    process.exit(EXIT_CODES.ERROR);
  }

  const createProjectPromptResponse = await createProjectPrompt(
    options,
    projectTemplates
  );
  const projectDest = path.resolve(getCwd(), createProjectPromptResponse.dest);

  trackCommandUsage(
    'project-create',
    { type: createProjectPromptResponse.projectTemplate.name },
    derivedAccountId
  );

  const {
    projectConfig: existingProjectConfig,
    projectDir: existingProjectDir,
  } = await getProjectConfig(projectDest);

  // Exit if the target destination is within an existing project
  if (existingProjectConfig && projectDest.startsWith(existingProjectDir)) {
    logger.error(
      i18n(`${i18nKey}.errors.cannotNestProjects`, {
        projectDir: existingProjectDir,
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await cloneGithubRepo(templateSource, projectDest, {
      sourceDir: createProjectPromptResponse.projectTemplate.path,
      tag: latestRepoReleaseTag,
      hideLogs: true,
    });
  } catch (err) {
    debugError(err);
    logger.error(i18n(`${i18nKey}.errors.failedToDownloadProject`));
    process.exit(EXIT_CODES.ERROR);
  }

  const projectConfigPath = path.join(projectDest, PROJECT_CONFIG_FILE);

  const parsedConfigFile: ProjectConfig = JSON.parse(
    fs.readFileSync(projectConfigPath).toString()
  );

  writeProjectConfig(projectConfigPath, {
    ...parsedConfigFile,
    name: createProjectPromptResponse.name,
  });

  // If the template is 'no-template', we need to manually create a src directory
  if (
    createProjectPromptResponse.projectTemplate.name ===
    EMPTY_PROJECT_TEMPLATE_NAME
  ) {
    fs.ensureDirSync(path.join(projectDest, 'src'));
  }

  logger.log('');
  logger.success(
    i18n(`${i18nKey}.logs.success`, {
      projectName: createProjectPromptResponse.name,
      projectDest,
    })
  );

  logger.log('');
  logger.log(chalk.bold(i18n(`${i18nKey}.logs.welcomeMessage`)));
  uiFeatureHighlight([
    'projectDevCommand',
    'projectHelpCommand',
    'feedbackCommand',
    'sampleProjects',
  ]);
  process.exit(EXIT_CODES.SUCCESS);
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
