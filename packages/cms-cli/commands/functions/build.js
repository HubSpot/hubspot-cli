const readline = require('readline');
const ora = require('ora');
const {
  addPortalOptions,
  addConfigOptions,
  setLogLevel,
  getPortalId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { buildPackage } = require('@hubspot/cms-lib/api/functions');
const { validatePortal } = require('../../lib/validation');

const makeSpinner = (functionPath, portalIdentifier) => {
  return ora(
    `Building new bundle for '${functionPath}' on portal '${portalIdentifier}'.\n`
  );
};

const handleKeypressToExit = exit => {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', (str, key) => {
    if (key && ((key.ctrl && key.name == 'c') || key.name === 'escape')) {
      exit();
    }
  });
};

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
};

exports.command = 'build <path>';
exports.describe =
  'builds a new dependency bundle for the specified function folder';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: functionPath } = options;
  const portalId = getPortalId(options);
  const spinner = makeSpinner(functionPath, portalId);

  trackCommandUsage('functions-build', { functionPath }, portalId);

  logger.debug(`Starting build for function(s) with path: ${functionPath}`);

  spinner.start();

  handleKeypressToExit(() => {
    spinner.stop();
    process.exit();
  });

  await buildPackage(portalId, `${functionPath}/package.json`);
  spinner.stop();
  logger.success(
    `Successfully built bundle from package.json for ${functionPath} on portal ${portalId}.`
  );
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to serverless function',
    type: 'string',
  });
  yargs.example([['$0 functions build myFunctionFolder.functions']]);

  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
