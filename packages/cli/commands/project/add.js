const { logger } = require('@hubspot/cli-lib/logger');
const { getAccountId } = require('@hubspot/cli-lib/lib/config');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const {
  PROJECT_COMPONENT_TEMPLATES,
} = require('@hubspot/cli-lib/lib/constants');

const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { projectAddPrompt } = require('../../lib/prompts/projectAddPrompt');
const { createProjectComponent } = require('../../lib/projects');
const { loadAndValidateOptions } = require('../../lib/validation');

const i18nKey = 'cli.commands.project.subcommands.add';

exports.command = 'add';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  logger.log('');
  logger.log(i18n(`${i18nKey}.creatingComponent.message`));
  logger.log('');
  const { type, name } = await projectAddPrompt(options);

  trackCommandUsage('project-add', null, accountId);

  try {
    await createProjectComponent(options.type || type, options.name || name);
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
      choices: PROJECT_COMPONENT_TEMPLATES.map(type => type.label),
    },
    name: {
      describe: i18n(`${i18nKey}.options.name.describe`),
      type: 'string',
    },
  });

  yargs.example([['$0 project add', i18n(`${i18nKey}.examples.default`)]]);

  return yargs;
};
