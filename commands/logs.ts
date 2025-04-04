// @ts-nocheck
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addGlobalOptions,
} = require('../lib/commonOpts');
const { trackCommandUsage } = require('../lib/usageTracking');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { outputLogs } = require('../lib/ui/serverlessFunctionLogs');
const {
  getFunctionLogs,
  getLatestFunctionLog,
} = require('@hubspot/local-dev-lib/api/functions');
const { tailLogs } = require('../lib/serverlessLogs');
const { i18n } = require('../lib/lang');
const { promptUser } = require('../lib/prompts/promptUtils');
const { EXIT_CODES } = require('../lib/enums/exitCodes');
const { isHubSpotHttpError } = require('@hubspot/local-dev-lib/errors/index');

const handleLogsError = (e, accountId, functionPath) => {
  if (isHubSpotHttpError(e) && (e.status === 404 || e.status == 400)) {
    logger.error(
      i18n(`commands.logs.errors.noLogsFound`, {
        accountId,
        functionPath,
      })
    );
  }
};

const endpointLog = async (accountId, functionPath, options) => {
  const { limit, latest, follow, compact } = options;
  const requestOptions = {
    limit,
    latest,
    follow,
    compact,
    endpoint: functionPath,
  };

  logger.debug(
    i18n(`commands.logs.gettingLogs`, {
      latest,
      functionPath,
    })
  );

  let logsResp;

  if (follow) {
    const tailCall = after =>
      getFunctionLogs(accountId, functionPath, { after });
    const fetchLatest = () => {
      try {
        return getLatestFunctionLog(accountId, functionPath);
      } catch (e) {
        handleLogsError(e, accountId, functionPath);
      }
    };

    await tailLogs(accountId, functionPath, fetchLatest, tailCall, compact);
  } else if (latest) {
    try {
      const { data } = await getLatestFunctionLog(accountId, functionPath);
      logsResp = data;
    } catch (e) {
      handleLogsError(e, accountId, functionPath);
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    try {
      const { data } = await getFunctionLogs(
        accountId,
        functionPath,
        requestOptions
      );
      logsResp = data;
    } catch (e) {
      handleLogsError(e, accountId, functionPath);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  if (logsResp) {
    return outputLogs(logsResp, requestOptions);
  }
};

exports.command = 'logs [endpoint]';
exports.describe = i18n(`commands.logs.describe`);

exports.handler = async options => {
  const { endpoint: endpointArgValue, latest, derivedAccountId } = options;

  trackCommandUsage('logs', { latest }, derivedAccountId);

  const { endpointPromptValue } = await promptUser({
    name: 'endpointPromptValue',
    message: i18n(`commands.logs.endpointPrompt`),
    when: !endpointArgValue,
  });

  endpointLog(
    derivedAccountId,
    endpointArgValue || endpointPromptValue,
    options
  );
};

exports.builder = yargs => {
  yargs.positional('endpoint', {
    describe: i18n(`commands.logs.positionals.endpoint.describe`),
    type: 'string',
  });
  yargs
    .options({
      latest: {
        alias: 'l',
        describe: i18n(`commands.logs.options.latest.describe`),
        type: 'boolean',
      },
      compact: {
        describe: i18n(`commands.logs.options.compact.describe`),
        type: 'boolean',
      },
      follow: {
        alias: ['f'],
        describe: i18n(`commands.logs.options.follow.describe`),
        type: 'boolean',
      },
      limit: {
        describe: i18n(`commands.logs.options.limit.describe`),
        type: 'number',
      },
    })
    .conflicts('follow', 'limit');

  yargs.example([
    ['$0 logs my-endpoint', i18n(`commands.logs.examples.default`)],
    ['$0 logs my-endpoint --limit=10', i18n(`commands.logs.examples.limit`)],
    ['$0 logs my-endpoint --follow', i18n(`commands.logs.examples.follow`)],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addGlobalOptions(yargs);

  return yargs;
};
