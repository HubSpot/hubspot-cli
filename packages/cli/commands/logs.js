const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../lib/commonOpts');
const { trackCommandUsage } = require('../lib/usageTracking');
const { logger } = require('@hubspot/cli-lib/logger');
const { outputLogs } = require('@hubspot/cli-lib/lib/logs');
const {
  getFunctionLogs,
  getLatestFunctionLog,
} = require('@hubspot/local-dev-lib/api/functions');
const { tailLogs } = require('../lib/serverlessLogs');
const { loadAndValidateOptions } = require('../lib/validation');
const { i18n } = require('../lib/lang');
const { EXIT_CODES } = require('../lib/enums/exitCodes');

const i18nKey = 'cli.commands.logs';

const handleLogsError = (e, accountId, functionPath) => {
  if (e.response.status === 404 || e.response.status == 400) {
    logger.error(
      i18n(`${i18nKey}.errors.noLogsFound`, {
        accountId,
        functionPath,
      })
    );
  }
};

const endpointLog = async (accountId, options) => {
  const { latest, follow, compact, endpoint: functionPath } = options;

  logger.debug(
    i18n(`${i18nKey}.gettingLogs`, {
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

    await tailLogs({
      accountId,
      compact,
      tailCall,
      fetchLatest,
      name: functionPath,
    });
  } else if (latest) {
    try {
      logsResp = await getLatestFunctionLog(accountId, functionPath);
    } catch (e) {
      handleLogsError(e, accountId, functionPath);
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    try {
      logsResp = await getFunctionLogs(accountId, functionPath, options);
    } catch (e) {
      handleLogsError(e, accountId, functionPath);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  if (logsResp) {
    return outputLogs(logsResp, options);
  }
};

exports.command = 'logs [endpoint]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { latest } = options;

  const accountId = getAccountId(options);

  trackCommandUsage('logs', { latest }, accountId);

  endpointLog(accountId, options);
};

exports.builder = yargs => {
  yargs.positional('endpoint', {
    describe: i18n(`${i18nKey}.positionals.endpoint.describe`),
    type: 'string',
  });
  yargs
    .options({
      latest: {
        alias: 'l',
        describe: i18n(`${i18nKey}.options.latest.describe`),
        type: 'boolean',
      },
      compact: {
        describe: i18n(`${i18nKey}.options.compact.describe`),
        type: 'boolean',
      },
      follow: {
        alias: ['t', 'tail', 'f'],
        describe: i18n(`${i18nKey}.options.follow.describe`),
        type: 'boolean',
      },
      limit: {
        alias: ['limit', 'n', 'max-count'],
        describe: i18n(`${i18nKey}.options.limit.describe`),
        type: 'number',
      },
    })
    .conflicts('follow', 'limit')
    .conflicts('functionName', 'endpoint');

  yargs.example([
    ['$0 logs my-endpoint', i18n(`${i18nKey}.examples.default`)],
    ['$0 logs my-endpoint --limit=10', i18n(`${i18nKey}.examples.limit`)],
    ['$0 logs my-endpoint --follow', i18n(`${i18nKey}.examples.follow`)],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
