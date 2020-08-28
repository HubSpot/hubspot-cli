const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');
const { addSecret } = require('@hubspot/cms-lib/api/secrets');
const { verifyFunctionScopesExist } = require('@hubspot/cms-lib/lib/scopes');
const { SCOPES } = require('@hubspot/cms-lib/lib/constants');

const { validatePortal } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { version } = require('../../package.json');

const {
  addConfigOptions,
  addLoggerOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');

const DESCRIPTION = 'Add a HubSpot secret';

async function action(args, options) {
  const { secretName, secretValue } = args;
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);
  trackCommandUsage('secrets-add', {}, portalId);

  if (
    !(await verifyFunctionScopesExist(portalId, {
      requiredScopes: Object.values(SCOPES.functions),
    }))
  ) {
    return;
  }

  try {
    await addSecret(portalId, secretName, secretValue);
    logger.log(
      `The secret "${secretName}" was added to the HubSpot portal: ${portalId}`
    );
  } catch (e) {
    logger.error(`The secret "${secretName}" was not added`);
    logApiErrorInstance(
      e,
      new ApiErrorContext({
        request: 'add secret',
        portalId,
      })
    );
  }
}

function configureSecretsAddCommand(program) {
  program
    .version(version)
    .description('Add a HubSpot secret')
    .arguments('<name> <value>')
    .action(async (secretName, secretValue) => {
      await action({ secretName, secretValue }, program);
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

exports.command = 'add <name> <value>';

exports.describe = DESCRIPTION;

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  yargs.positional('name', {
    describe: 'Name of the secret',
    type: 'string',
  });
  yargs.positional('value', {
    describe: 'The secret to be stored such as an API key',
    type: 'string',
  });
  return yargs;
};

exports.handler = async argv => {
  await action({ secretName: argv.name, secretValue: argv.value }, argv);
};

exports.configureSecretsAddCommand = configureSecretsAddCommand;
