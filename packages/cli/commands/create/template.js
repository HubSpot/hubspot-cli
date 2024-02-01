const { createTemplate } = require('@hubspot/local-dev-lib/cms/templates');
const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('../../lib/errorHandlers/standardErrors');
const {
  createTemplatePrompt,
} = require('../../lib/prompts/createTemplatePrompt');
const { i18n } = require('../../lib/lang');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { buildLogCallbacks } = require('../../lib/logCallbacks');

const i18nKey = 'cli.commands.create.subcommands.template';

const createTemplateLogCallbacks = buildLogCallbacks({
  creatingFile: `${i18nKey}.logCallbacks.creatingFile`,
});

module.exports = {
  dest: ({ dest }) => dest,
  validate: ({ name }) => {
    if (!name) {
      logger.error(i18n(`${i18nKey}.errors.nameRequired`));
      return false;
    }

    return true;
  },
  execute: async ({ name, dest }) => {
    const { templateType } = await createTemplatePrompt();
    try {
      await createTemplate(
        name,
        dest,
        templateType,
        {},
        createTemplateLogCallbacks
      );
    } catch (e) {
      logErrorInstance(e);
      process.exit(EXIT_CODES.ERROR);
    }
    return { templateType };
  },
};
