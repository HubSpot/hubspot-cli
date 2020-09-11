const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');
const { updateSecret } = require('@hubspot/cms-lib/api/secrets');
const { getScopeDataForFunctions } = require('@hubspot/cms-lib/lib/scopes');

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

const DESCRIPTION = 'Update an existing HubSpot secret';

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
  trackCommandUsage('secrets-update', {}, portalId);

  try {
    await updateSecret(portalId, secretName, secretValue);
    logger.log(
      `The secret "${secretName}" was updated in the HubSpot portal: ${portalId}`
    );
  } catch (e) {
    logger.error(`The secret "${secretName}" was not updated`);
    logServerlessFunctionApiErrorInstance(
      e,
      await getScopeDataForFunctions(portalId),
      new ApiErrorContext({
        request: 'update secret',
        portalId,
      })
    );
  }
}

function configureSecretsUpdateCommand(program) {
  program
    .version(version)
    .description('Update an existing HubSpot secret')
    .arguments('<name> <value>')
    .action(async (secretName, secretValue) => {
      await action({ secretName, secretValue }, program);
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

exports.command = 'update <name> <value>';

exports.describe = DESCRIPTION;

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  yargs.positional('name', {
    describe: 'Name of the secret to be updated',
    type: 'string',
  });
  yargs.positional('value', {
    describe: 'The secret to be stored',
    type: 'string',
  });
  return yargs;
};

exports.handler = async argv => {
  await action({ secretName: argv.name, secretValue: argv.value }, argv);
};

exports.configureSecretsUpdateCommand = configureSecretsUpdateCommand;
