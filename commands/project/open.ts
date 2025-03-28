// @ts-nocheck
const open = require('open');
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { getProjectConfig, ensureProjectExists } = require('../../lib/projects');
const { getProjectDetailUrl } = require('../../lib/projects/urls');
const { projectNamePrompt } = require('../../lib/prompts/projectNamePrompt');
const { uiBetaTag } = require('../../lib/ui');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'commands.project.subcommands.open';

exports.command = 'open';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  const { project, derivedAccountId } = options;

  trackCommandUsage('project-open', null, derivedAccountId);

  const { projectConfig } = await getProjectConfig();

  let projectName = project;

  if (projectName) {
    const { projectExists } = await ensureProjectExists(
      derivedAccountId,
      projectName,
      {
        allowCreate: false,
      }
    );

    if (!projectExists) {
      process.exit(EXIT_CODES.ERROR);
    }
  } else if (!projectName && projectConfig) {
    projectName = projectConfig.name;
  } else if (!projectName && !projectConfig) {
    const namePrompt = await projectNamePrompt(derivedAccountId);

    if (!namePrompt.projectName) {
      process.exit(EXIT_CODES.ERROR);
    }
    projectName = namePrompt.projectName;
  }

  const url = getProjectDetailUrl(projectName, derivedAccountId);
  open(url, { url: true });
  logger.success(i18n(`${i18nKey}.success`, { projectName }));
  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addTestingOptions(yargs);

  yargs.options({
    project: {
      describe: i18n(`${i18nKey}.options.project.describe`),
      type: 'string',
    },
  });

  yargs.example([['$0 project open', i18n(`${i18nKey}.examples.default`)]]);

  return yargs;
};
