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
const { trackCommandUsage } = require('../lib/usageTracking');

const COMMAND_NAME = 'fetch';

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
    .middleware([
      logDebugInfo,
      argv => {
        loadConfig(argv.config);
        const dest = resolveLocalPath(argv.dest);
        const portalId = getPortalId(argv);
        const mode = getMode(argv);
        return { dest, portalId, mode };
      },
    ]);
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addOverwriteOptions(yargs, true);
  addModeOptions(yargs, { read: true }, true);
  return yargs;
};

exports.handler = async argv => {
  const { src, dest, portalId, mode } = argv;
  if (typeof src !== 'string') {
    process.exit(1);
  }
  if (
    !(validateConfig() && (await validatePortal(argv)) && validateMode(argv))
  ) {
    process.exit(1);
  }
  trackCommandUsage(COMMAND_NAME, { mode }, portalId);
  // Fetch and write file/folder.
  downloadFileOrFolder({ portalId, src, dest, mode, options: argv });
};
