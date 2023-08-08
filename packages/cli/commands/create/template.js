const {
  createTemplatePrompt,
} = require('../../lib/prompts/createTemplatePrompt');
const { logger } = require('@hubspot/cli-lib/logger');
const { i18n } = require('../../lib/lang');
const { createTemplate } = require('@hubspot/cli-lib/templates');

const i18nKey = 'cli.commands.create.subcommands.template';

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
    await createTemplate(name, dest, templateType);
    return { templateType };
  },
};
