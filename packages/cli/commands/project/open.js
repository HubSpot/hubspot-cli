const open = require('open');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  getProjectConfig,
  getProjectDetailUrl,
  verifyProjectExists,
} = require('../../lib/projects');
const { projectNamePrompt } = require('../../lib/prompts/projectNamePrompt');

const i18nKey = 'cli.commands.project.subcommands.open';

exports.command = 'open';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const { project } = options;
  const { projectConfig } = await getProjectConfig();
  let projectName = project;
  if (projectName) {
    const projectExists = await verifyProjectExists(accountId, projectName);
    if (!projectExists) {
      return;
    }
  } else if (!projectName && projectConfig) {
    projectName = projectConfig.name;
  } else if (!projectName && !projectConfig) {
    const namePrompt = await projectNamePrompt(accountId, projectConfig);
    const projectExists = await verifyProjectExists(
      accountId,
      namePrompt.projectName
    );
    if (!projectExists) {
      return;
    }
    projectName = namePrompt.projectName;
  }
  const url = getProjectDetailUrl(projectName, accountId);
  open(url, { url: true });
  logger.success(i18n(`${i18nKey}.success`, { projectName }));
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
