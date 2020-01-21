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

const validateInputs = async argv => {
  let dest;
  let portalId;
  let mode;
  try {
    loadConfig(argv.config);
    dest = resolveLocalPath(argv.dest);
    portalId = getPortalId(argv);
    mode = getMode(argv);
  } catch (e) {
    // noop
  }
  const resultArgs = { ...argv, dest, portalId, mode };
  if (
    typeof src !== 'string' ||
    typeof dest !== 'string' ||
    !validateConfig() ||
    !validateMode(resultArgs) ||
    !(await validatePortal(resultArgs))
  ) {
    // Required missing positionals will be logged by yargs
    process.exit(1);
  }
  return resultArgs;
};

/*
 * Module
 */

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
    .middleware([logDebugInfo, validateInputs]);
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addOverwriteOptions(yargs, true);
  addModeOptions(yargs, true);
  return yargs;
};

exports.handler = argv => {
  const { src, dest, portalId, mode } = argv;
  // Fetch and write file/folder.
  downloadFileOrFolder({ portalId, src, dest, mode, options: argv });
  return {
    COMMAND_NAME,
    argv,
  };
};
