// @ts-nocheck
const moment = require('moment');
const { getRoutes } = require('@hubspot/local-dev-lib/api/functions');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError, ApiErrorContext } = require('../../lib/errorHandlers/index');
const { getTableContents, getTableHeader } = require('../../lib/ui/table');
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');

const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = ['list', 'ls'];
exports.describe = i18n('commands.function.subcommands.list.describe');

exports.handler = async options => {
  const { derivedAccountId } = options;

  trackCommandUsage('functions-list', null, derivedAccountId);

  logger.debug(
    i18n('commands.function.subcommands.list.debug.gettingFunctions')
  );

  const { data: routesResp } = await getRoutes(derivedAccountId).catch(
    async e => {
      logError(e, new ApiErrorContext({ accountId: derivedAccountId }));
      process.exit(EXIT_CODES.SUCCESS);
    }
  );

  if (!routesResp.objects.length) {
    return logger.info(
      i18n('commands.function.subcommands.list.info.noFunctions')
    );
  }

  if (options.json) {
    return logger.log(routesResp.objects);
  }

  const functionsAsArrays = routesResp.objects.map(func => {
    const { route, method, created, updated, secretNames } = func;
    return [
      route,
      method,
      secretNames.join(', '),
      moment(created).format(),
      moment(updated).format(),
    ];
  });

  functionsAsArrays.unshift(
    getTableHeader(['Route', 'Method', 'Secrets', 'Created', 'Updated'])
  );
  return logger.log(getTableContents(functionsAsArrays));
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.options({
    json: {
      describe: i18n(
        'commands.function.subcommands.list.options.json.describe'
      ),
      type: 'boolean',
    },
  });
};
