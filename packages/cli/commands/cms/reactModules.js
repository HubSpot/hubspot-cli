const fs = require('fs');
const { logger } = require('@hubspot/cli-lib/logger');
const { listReactModules } = require('@hubspot/cli-lib/modules');
const { downloadGitHubRepoContents } = require('@hubspot/cli-lib/github');
const { i18n } = require('../../lib/lang');
const {
  logFileSystemErrorInstance,
} = require('../../lib/errorHandlers/fileSystemErrors');
const path = require('path');

const i18nKey = 'cli.commands.cms.subcommands.reactModule';

const MOCK_AVAILABLE_REACT_MODULES = [
  'SampleReactModule-V0',
  'Button-V0',
  'Button-V1',
  'ImageGallery-V0',
];

exports.command = 'get-react-module [name] [dest] [--list]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { name, dest, list } = options;

  if (list) {
    const responseList = await listReactModules();
    logger.group('Modules available to download:');
    responseList.map(x => {
      logger.log(x);
    });
    logger.groupEnd('Modules available to download:');
  } else {
    console.log(`fetch the react module ${name} to ${dest}`);

    const destPath = path.join(dest, `${name}`);

    await downloadGitHubRepoContents(
      'HubSpot/cms-sample-assets',
      `modules/${name}`,
      destPath
    );
  }

  /* ----- LIST ------ */
  /* --list:
  Query remote repo for dir names for available modules and return output names
  */

  // const listAvailableModules = async () => {
  //   console.log('in reactModules.js');

  //   // const modules = MOCK_AVAILABLE_REACT_MODULES;
  //   const modules = await listReactModules();
  //   console.log(modules);

  //   // modules.map(module => logger.log(module));
  // };

  // if (list) {
  //   listAvailableModules();
  //   return;
  // }

  /* --- GET --- */
  /*
  Check to see if name matches entries in the remote repo (use list function)
  If yes - download to dest
  If no - throw error to logger about how the module name is not correct
  */

  /* Error states

  Mistyped module name
  GH fetch error
  Dest folder doesn't exist
  No name/dest and no list flag -- should prompt to enter something
  */

  /*
  Check to see if dest is a directory otherwise log error

  try {
    await fs.ensureDir(dest);
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.unusablePath`, {
        path: dest,
      })
    );
    logFileSystemErrorInstance(e, {
      filepath: dest,
      write: true,
    });
    return;
  }
  */
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
