const path = require('path');
const { getCwd } = require('@hubspot/cli-lib/path');
const { logger } = require('@hubspot/cli-lib/logger');
const { getAccountId } = require('@hubspot/cli-lib/lib/config');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');

const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const {
  projectComponentsPrompt,
} = require('../../lib/prompts/projectCOmponentsPrompt');
const { createProjectComponent } = require('../../lib/projects');
const { loadAndValidateOptions } = require('../../lib/validation');

const i18nKey = 'cli.commands.project.subcommands.components';

const COMPONENT_TEMPLATES = ['Component1', 'Component2'];

exports.command = 'components';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  const { template, location } = await projectComponentsPrompt(options);

  trackCommandUsage('project-components', null, accountId);

  try {
    await createProjectComponent(
      path.resolve(getCwd(), options.location || location),
      options.template || template
    );
  } catch (error) {
    logErrorInstance(error);
  }

  logger.log(i18n(`${i18nKey}.success.message`));
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
      choices: COMPONENT_TEMPLATES.map(template => template.name),
    },
  });

  yargs.example([
    ['$0 project components', i18n(`${i18nKey}.examples.default`)],
  ]);

  return yargs;
};
