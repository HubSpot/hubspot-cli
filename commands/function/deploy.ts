// @ts-nocheck
const SpinniesManager = require('../../lib/ui/SpinniesManager');
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logError, ApiErrorContext } = require('../../lib/errorHandlers/index');
const { uiAccountDescription } = require('../../lib/ui');
const { poll } = require('../../lib/polling');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  buildPackage,
  getBuildStatus,
} = require('@hubspot/local-dev-lib/api/functions');
const { outputBuildLog } = require('../../lib/serverlessLogs');
const { i18n } = require('../../lib/lang');
const { isHubSpotHttpError } = require('@hubspot/local-dev-lib/errors/index');

exports.command = 'deploy <path>';
exports.describe = false;

exports.handler = async options => {
  const { path: functionPath, derivedAccountId } = options;
  const splitFunctionPath = functionPath.split('.');

  trackCommandUsage('functions-deploy', null, derivedAccountId);

  if (
    !splitFunctionPath.length ||
    splitFunctionPath[splitFunctionPath.length - 1] !== 'functions'
  ) {
    logger.error(
      i18n('commands.function.subcommands.deploy.errors.notFunctionsFolder', {
        functionPath,
      })
    );
    return;
  }

  logger.debug(
    i18n('commands.function.subcommands.deploy.debug.startingBuildAndDeploy', {
      functionPath,
    })
  );

  SpinniesManager.init();

  SpinniesManager.add('loading', {
    text: i18n('commands.function.subcommands.deploy.loading', {
      account: uiAccountDescription(derivedAccountId),
      functionPath,
    }),
  });

  try {
    const { data: buildId } = await buildPackage(
      derivedAccountId,
      functionPath
    );
    const successResp = await poll(() =>
      getBuildStatus(derivedAccountId, buildId)
    );
    const buildTimeSeconds = (successResp.buildTime / 1000).toFixed(2);

    SpinniesManager.succeed('loading');

    await outputBuildLog(successResp.cdnUrl);
    logger.success(
      i18n('commands.function.subcommands.deploy.success.deployed', {
        accountId: derivedAccountId,
        buildTimeSeconds,
        functionPath,
      })
    );
  } catch (e) {
    SpinniesManager.fail('loading', {
      text: i18n('commands.function.subcommands.deploy.loadingFailed', {
        account: uiAccountDescription(derivedAccountId),
        functionPath,
      }),
    });

    if (isHubSpotHttpError(e) && e.status === 404) {
      logger.error(
        i18n('commands.function.subcommands.deploy.errors.noPackageJson', {
          functionPath,
        })
      );
    } else if (e.status === 'ERROR') {
      await outputBuildLog(e.cdnUrl);
      logger.error(
        i18n('commands.function.subcommands.deploy.errors.buildError', {
          details: e.errorReason,
        })
      );
    } else {
      logError(
        e,
        new ApiErrorContext({
          accountId: derivedAccountId,
          request: functionPath,
        })
      );
    }
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(
      'commands.function.subcommands.deploy.positionals.path.describe'
    ),
    type: 'string',
  });

  yargs.example([
    [
      '$0 functions deploy myFunctionFolder.functions',
      i18n('commands.function.subcommands.deploy.examples.default'),
    ],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
