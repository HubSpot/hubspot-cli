const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  createProjectPrompt,
} = require('../../lib/prompts/createProjectPrompt');
const { i18n } = require('../../lib/lang');
const {
  fetchPublicApp,
  clonePublicApp,
  validateAppId,
} = require('../../lib/publicApps');
const { uiBetaTag } = require('../../lib/ui');

const i18nKey = 'cli.commands.project.subcommands.cloneApp';

exports.command = 'clone-app';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);

  let appId;
  if (options.appId) {
    appId = options.appId;
    await validateAppId(appId, accountId, accountConfig.name);
  } else {
    appId = await fetchPublicApp(accountId, accountConfig.name, options);
    await validateAppId(appId, accountId, accountConfig.name);
  }

  const { name, location } = await createProjectPrompt('', options, appId);

  trackCommandUsage('clone-app', {}, accountId);

  if (appId) {
    await clonePublicApp(appId, name, location);
  }
};

exports.builder = yargs => {
  yargs.options({
    name: {
      describe: i18n(`${i18nKey}.options.name.describe`),
      type: 'string',
    },
    location: {
      describe: i18n(`${i18nKey}.options.location.describe`),
      type: 'string',
    },
    appId: {
      describe: i18n(`${i18nKey}.options.appId.describe`),
      type: 'number',
    },
  });

  yargs.example([
    ['$0 project clone-app', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
