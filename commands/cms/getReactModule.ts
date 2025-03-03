// @ts-nocheck
const fs = require('fs');
const path = require('path');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { retrieveDefaultModule } = require('@hubspot/local-dev-lib/cms/modules');
const { i18n } = require('../../lib/lang');
const { logError } = require('../../lib/errorHandlers/index');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { listPrompt } = require('../../lib/prompts/promptUtils');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'commands.cms.subcommands.getReactModule';

exports.command = 'get-react-module [name] [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { name, dest } = options;

  trackCommandUsage('get-react-modules');

  let moduleToRetrieve = name;

  if (!moduleToRetrieve) {
    let availableModules;
    try {
      availableModules = await retrieveDefaultModule(null, '');
    } catch (e) {
      logError(e);
    }

    const moduleChoice = await listPrompt(
      i18n(`${i18nKey}.selectModulePrompt`),
      {
        choices: availableModules.map(module => module.name),
      }
    );
    moduleToRetrieve = moduleChoice;
  }

  const destPath = dest
    ? path.join(path.resolve(getCwd(), dest), `${moduleToRetrieve}`)
    : path.join(getCwd(), `${moduleToRetrieve}`);

  if (fs.existsSync(destPath)) {
    logger.error(
      i18n(`${i18nKey}.errors.pathExists`, {
        path: destPath,
      })
    );
    return;
  }

  try {
    await retrieveDefaultModule(moduleToRetrieve, destPath);

    logger.success(
      i18n(`${i18nKey}.success.moduleDownloaded`, {
        moduleName: moduleToRetrieve,
        path: destPath,
      })
    );
  } catch (e) {
    if (e.cause && e.cause.code === 'ERR_BAD_REQUEST') {
      logger.error(i18n(`${i18nKey}.errors.invalidName`));
    } else {
      logError(e);
    }
  }
  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = yargs => {
  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
  return yargs;
};
