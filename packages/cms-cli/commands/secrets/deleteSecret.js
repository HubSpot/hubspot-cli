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
const { deleteSecret } = require('@hubspot/cms-lib/api/secrets');

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

const DESCRIPTION = 'Delete a HubSpot secret';

async function action({ secretName }, options) {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);
  trackCommandUsage('secrets-delete', {}, portalId);

  try {
    await deleteSecret(portalId, secretName);
    logger.log(
      `The secret "${secretName}" was deleted from the HubSpot portal: ${portalId}`
    );
  } catch (e) {
    logger.error(`The secret "${secretName}" was not deleted`);
    logApiErrorInstance(
      e,
      new ApiErrorContext({
        request: `delete a secret`,
        portalId,
      })
    );
  }
}

function configureSecretsDeleteCommand(program) {
  program
    .version(version)
    .description(DESCRIPTION)
    .arguments('<name>')
    .action(async secretName => {
      action({ secretName }, program);
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

exports.command = `delete <name>`;

exports.describe = DESCRIPTION;

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  yargs.positional('name', {
    describe: 'Name of the secret',
    type: 'string',
  });
  return yargs;
};

exports.handler = async argv => {
  await action({ secretName: argv.name }, argv);
};

exports.configureSecretsDeleteCommand = configureSecretsDeleteCommand;
