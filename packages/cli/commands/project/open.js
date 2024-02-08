const open = require('open');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('../../lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  getProjectConfig,
  getProjectDetailUrl,
  ensureProjectExists,
} = require('../../lib/projects');
const { projectNamePrompt } = require('../../lib/prompts/projectNamePrompt');
const { uiBetaTag } = require('../../lib/ui');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'cli.commands.project.subcommands.open';

exports.command = 'open [--project]';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const { project } = options;

  trackCommandUsage('project-open', null, accountId);

  const { projectConfig } = await getProjectConfig();

  let projectName = project;

  if (projectName) {
    const projectExists = await ensureProjectExists(accountId, projectName, {
      allowCreate: false,
    });

    if (!projectExists) {
      process.exit(EXIT_CODES.ERROR);
    }
  } else if (!projectName && projectConfig) {
    projectName = projectConfig.name;
  } else if (!projectName && !projectConfig) {
    const namePrompt = await projectNamePrompt(accountId);

    if (!namePrompt.projectName) {
      process.exit(EXIT_CODES.ERROR);
    }
    projectName = namePrompt.projectName;
  }

  const url = getProjectDetailUrl(projectName, accountId);
  open(url, { url: true });
  logger.success(i18n(`${i18nKey}.success`, { projectName }));
  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  yargs.options({
    project: {
      describe: i18n(`${i18nKey}.options.project.describe`),
      type: 'string',
    },
  });

  yargs.example([['$0 project open', i18n(`${i18nKey}.examples.default`)]]);

  return yargs;
};
