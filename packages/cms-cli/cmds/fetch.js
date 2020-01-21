const { getCwd } = require('@hubspot/cms-lib/path');
const { downloadFileOrFolder } = require('@hubspot/cms-lib/fileMapper');
const { loadConfig } = require('@hubspot/cms-lib');

const {
  addConfigOptions,
  addPortalOptions,
  addOverwriteOptions,
  addModeOptions,
  getPortalId,
  getMode,
} = require('../lib/commonOpts');
const { resolveLocalPath } = require('../lib/filesystem');
const {
  validateConfig,
  validatePortal,
  validateMode,
} = require('../lib/validation');
const { logDebugInfo } = require('../lib/debugInfo');

const COMMAND_NAME = 'fetch';

const parseInputs = argv => {
  loadConfig(argv.config);
  const dest = resolveLocalPath(argv.dest);
  const portalId = getPortalId(argv);
  const mode = getMode(argv);
  return { dest, portalId, mode };
};

const validateInputs = async argv => {
  return {
    isValidInput:
      typeof argv.src === 'string' &&
      (validateConfig() && validateMode(argv) && (await validatePortal(argv))),
  };
};

exports.command = `${COMMAND_NAME} <src> [dest]`;

exports.describe =
  'Fetch a file, directory or module from HubSpot and write to a path on your computer';

exports.builder = yargs => {
  yargs
    .positional('src', {
      describe: 'Remote hubspot path',
      type: 'string',
    })
    .positional('dest', {
      default: getCwd(),
      describe: 'Local filesystem path',
      type: 'string',
    })
    .middleware([logDebugInfo, parseInputs, validateInputs]);
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addOverwriteOptions(yargs, true);
  addModeOptions(yargs, true);
  return yargs;
};

exports.handler = argv => {
  const { src, dest, portalId, mode, isValidInput } = argv;
  if (!isValidInput) {
    process.exit(1);
  }
  // Fetch and write file/folder.
  downloadFileOrFolder({ portalId, src, dest, mode, options: argv });
  return {
    COMMAND_NAME,
    argv,
  };
};
