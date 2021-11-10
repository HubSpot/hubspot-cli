const fs = require('fs');
const path = require('path');

const {
  watch,
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { getCwd } = require('@hubspot/cli-lib/path');
const { logger } = require('@hubspot/cli-lib/logger');

const {
  addConfigOptions,
  addAccountOptions,
  addModeOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
  getMode,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { validateAccount, validateMode } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.watch';

exports.command = 'watch <src> <dest>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const {
    src,
    dest,
    config: configPath,
    remove,
    initialUpload,
    disableInitial,
    notify,
  } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (
    !(
      validateConfig() &&
      (await validateAccount(options)) &&
      validateMode(options)
    )
  ) {
    process.exit(1);
  }

  const accountId = getAccountId(options);
  const mode = getMode(options);

  const absoluteSrcPath = path.resolve(getCwd(), src);
  try {
    const stats = fs.statSync(absoluteSrcPath);
    if (!stats.isDirectory()) {
      logger.log(
        i18n(`${i18nKey}.errors.invalidPath`, {
          path: src,
        })
      );
      return;
    }
  } catch (e) {
    logger.log(
      i18n(`${i18nKey}.errors.invalidPath`, {
        path: src,
      })
    );
    return;
  }

  if (!dest) {
    logger.log(i18n(`${i18nKey}.errors.destinationRequired`));
    return;
  }

  if (disableInitial) {
    logger.info(i18n(`${i18nKey}.warnings.disableInitial`));
  } else {
    logger.info(i18n(`${i18nKey}.warnings.notUploaded`, { path: src }));

    if (!initialUpload) {
      logger.info(i18n(`${i18nKey}.warnings.initialUpload`));
    }
  }

  trackCommandUsage('watch', { mode }, accountId);
  watch(accountId, absoluteSrcPath, dest, {
    mode,
    remove,
    disableInitial: initialUpload ? false : true,
    notify,
  });
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addModeOptions(yargs, { write: true }, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
  yargs.option('remove', {
    alias: 'r',
    describe: i18n(`${i18nKey}.options.remove.describe`),
    type: 'boolean',
  });
  yargs.option('initial-upload', {
    alias: 'i',
    describe: i18n(`${i18nKey}.options.initialUpload.describe`),
    type: 'boolean',
  });
  yargs.option('disable-initial', {
    alias: 'd',
    describe: i18n(`${i18nKey}.options.disableInitial.describe`),
    type: 'boolean',
    hidden: true,
  });
  yargs.option('notify', {
    alias: 'n',
    describe: i18n(`${i18nKey}.options.notify.describe`),
    type: 'string',
    requiresArg: true,
  });

  return yargs;
};
