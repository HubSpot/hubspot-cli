const fs = require('fs');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { retrieveDefaultModule } = require('@hubspot/local-dev-lib/cms/modules');
const { i18n } = require('../../lib/lang');
const path = require('path');
const { trackCommandUsage } = require('../../lib/usageTracking');

const i18nKey = 'cli.commands.cms.subcommands.reactModule';

exports.command = 'get-react-module [--name] [--dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { name, dest } = options;

  trackCommandUsage('get-react-modules');

  const destPath = dest
    ? path.join(dest, `${name}`)
    : path.join(process.cwd(), `${name}`);

  if (fs.existsSync(destPath)) {
    logger.error(
      i18n(`${i18nKey}.errors.pathExists`, {
        path: destPath,
      })
    );
    return;
  }

  try {
    const modules = await retrieveDefaultModule(name, destPath);

    if (!name) {
      logger.group(i18n(`${i18nKey}.groupLabel`));
      modules.forEach(module => {
        logger.log(module.name);
      });
      logger.groupEnd(i18n(`${i18nKey}.groupLabel`));
    } else {
      logger.success(
        i18n(`${i18nKey}.success.moduleDownloaded`, {
          moduleName: name,
          path: destPath,
        })
      );
    }
  } catch (e) {
    if (e.cause && e.cause.code === 'ERR_BAD_REQUEST') {
      logger.error(i18n(`${i18nKey}.errors.invalidName`));
    } else {
      logger.error(e);
    }
  }
};

exports.builder = yargs => {
  yargs.option('name', {
    describe: i18n(`${i18nKey}.options.name.describe`),
    type: 'string',
  });
  yargs.option('dest', {
    describe: i18n(`${i18nKey}.options.dest.describe`),
    type: 'string',
  });
  return yargs;
};
