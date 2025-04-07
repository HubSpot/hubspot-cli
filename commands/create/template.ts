// @ts-nocheck
const { createTemplate } = require('@hubspot/local-dev-lib/cms/templates');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../lib/errorHandlers/index');
const {
  createTemplatePrompt,
} = require('../../lib/prompts/createTemplatePrompt');
const { i18n } = require('../../lib/lang');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');


module.exports = {
  dest: ({ dest }) => dest,
  validate: ({ name }) => {
    if (!name) {
      logger.error(i18n(`commands.create.subcommands.template.errors.nameRequired`));
      return false;
    }

    return true;
  },
  execute: async ({ name, dest }) => {
    const { templateType } = await createTemplatePrompt();
    try {
      await createTemplate(name, dest, templateType);
    } catch (e) {
      logError(e);
      process.exit(EXIT_CODES.ERROR);
    }
    return { templateType };
  },
};
