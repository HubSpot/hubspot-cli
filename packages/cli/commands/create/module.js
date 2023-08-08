const { createModulePrompt } = require('../../lib/prompts/createModulePrompt');
const { logger } = require('@hubspot/cli-lib/logger');
const { i18n } = require('../../lib/lang');
const { createModule } = require('@hubspot/cli-lib/modules');

const i18nKey = 'cli.commands.create.subcommands.module';

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
    const moduleDefinition = await createModulePrompt();
    await createModule(moduleDefinition, name, dest);
  },
};
