const fs = require('fs');
const path = require('path');

const { watch } = require('@hubspot/cli-lib');
const { getCwd } = require('@hubspot/cli-lib/path');
const { logger } = require('@hubspot/cli-lib/logger');

const {
  addConfigOptions,
  addAccountOptions,
  addModeOptions,
  addUseEnvironmentOptions,
  getAccountId,
  getMode,
} = require('../lib/commonOpts');
const { validateMode, loadAndValidateOptions } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');

exports.command = 'watch <src> <dest>';
exports.describe =
  'Watch a directory on your computer for changes and upload the changed files to the HubSpot CMS';

exports.handler = async options => {
  const { src, dest, remove, initialUpload, disableInitial, notify } = options;

  await loadAndValidateOptions(options);

  if (!validateMode(options)) {
    process.exit(1);
  }

  const accountId = getAccountId(options);
  const mode = getMode(options);

  const absoluteSrcPath = path.resolve(getCwd(), src);
  try {
    const stats = fs.statSync(absoluteSrcPath);
    if (!stats.isDirectory()) {
      logger.log(`The "${src}" is not a path to a directory`);
      return;
    }
  } catch (e) {
    logger.log(`The "${src}" is not a path to a directory`);
    return;
  }

  if (!dest) {
    logger.log('A destination directory needs to be passed');
    return;
  }

  if (disableInitial) {
    logger.info(
      'Passing the "--disable-initial" option is no longer necessary. Running "hs watch" no longer uploads the watched directory by default.'
    );
  } else {
    logger.info(
      `The "watch" command no longer uploads the watched directory when started. The directory "${src}" was not uploaded.`
    );

    if (!initialUpload) {
      logger.info(
        'To upload the directory run "hs upload" beforehand or add the "--initial-upload" option when running "hs watch".'
      );
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
    describe:
      'Path to the local directory your files are in, relative to your current working directory',
    type: 'string',
  });
  yargs.positional('dest', {
    describe: 'Path in HubSpot Design Tools. Can be a net new path',
    type: 'string',
  });
  yargs.option('remove', {
    alias: 'r',
    describe:
      'Will cause watch to delete files in your HubSpot account that are not found locally.',
    type: 'boolean',
  });
  yargs.option('initial-upload', {
    alias: 'i',
    describe: 'Upload directory before watching for updates',
    type: 'boolean',
  });
  yargs.option('disable-initial', {
    alias: 'd',
    describe: 'Disable the initial upload when watching a directory (default)',
    type: 'boolean',
    hidden: true,
  });
  yargs.option('notify', {
    alias: 'n',
    describe:
      'Log to specified file when a watch task is triggered and after workers have gone idle. Ex. --notify path/to/file',
    type: 'string',
    requiresArg: true,
  });

  return yargs;
};
