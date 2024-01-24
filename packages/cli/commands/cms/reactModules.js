const fs = require('fs');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  listGithubRepoContents,
  downloadGithubRepoContents,
} = require('@hubspot/local-dev-lib/github');
const {
  throwErrorWithMessage,
} = require('@hubspot/local-dev-lib/errors/standardErrors');
const { i18n } = require('../../lib/lang');
const path = require('path');
const { trackCommandUsage } = require('../../lib/usageTracking');

const i18nKey = 'cli.commands.cms.subcommands.reactModule';

exports.command = 'get-react-module [name] [dest] [--list]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { name, dest, list } = options;
  trackCommandUsage('get-react-modules');

  //TODO: trackCommandUsage()
  //TODO: i18n
  //TODO: Move logic to local-dev-lib -- modules.ts -- fetchReactModules() and call from here

  if (list) {
    try {
      const contents = await listGithubRepoContents(
        'HubSpot/cms-sample-assets',
        'modules/',
        'dir'
      );

      logger.group('React modules available to download:');
      contents.forEach(module => {
        logger.log(module.name);
      });
      logger.groupEnd('React modules available to download:');
    } catch (e) {
      console.log(e); // TODO: Error handling
    }
  } else {
    const destPath = path.join(dest, `${name}`);

    if (fs.existsSync(destPath)) {
      throwErrorWithMessage(`${i18nKey}.errors.pathExists`, {
        path: destPath,
      });
    }

    try {
      await downloadGithubRepoContents(
        'HubSpot/cms-sample-assets',
        `modules/${name}`,
        destPath
      );

      logger.success(`${name} succesfully downloaded to ${destPath}`);
    } catch (e) {
      // Error to catch: requested module name is incorrect -- results in bad request error
      console.log(e); // TODO: Error handling
    }
  }
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
  yargs.option('list', {
    describe: i18n(`${i18nKey}.options.list.describe`),
    type: 'boolean',
    default: false,
  });
  return yargs;
};
