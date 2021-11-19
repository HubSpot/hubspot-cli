const { getRoutes } = require('@hubspot/cli-lib/api/functions');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { getFunctionArrays } = require('@hubspot/cli-lib/lib/functions');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/cli-lib/lib/table');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');

exports.command = 'list';
exports.describe = 'List currently deployed functions';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { json, compact } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('functions-list', { json, compact }, accountId);

  logger.debug('Getting currently deployed functions');

  const routesResp = await getRoutes(accountId).catch(async e => {
    await logApiErrorInstance(accountId, e, new ApiErrorContext({ accountId }));
    process.exit();
  });

  if (!routesResp.objects.length) {
    return logger.info('No functions found.');
  }

  if (options.json) {
    return logger.log(routesResp.objects);
  }

  const functionsAsArrays = getFunctionArrays(routesResp);
  functionsAsArrays.unshift(
    getTableHeader(['Route', 'Method', 'Secrets', 'Created', 'Updated'])
  );
  return logger.log(getTableContents(functionsAsArrays));
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.options({
    json: {
      describe: 'output raw json data',
      type: 'boolean',
    },
  });
};
