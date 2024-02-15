const { logger } = require('@hubspot/local-dev-lib/logger');
const { createModule } = require('@hubspot/local-dev-lib/cms/modules');
const { i18n } = require('../../lib/lang');
const { createModulePrompt } = require('../../lib/prompts/createModulePrompt');
const { logErrorInstance } = require('../../lib/errorHandlers/standardErrors');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

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
    try {
      await createModule(moduleDefinition, name, dest);
    } catch (e) {
      logErrorInstance(e);
      process.exit(EXIT_CODES.ERROR);
    }
  },
};
