// @ts-nocheck
const { i18n } = require('../../lib/lang');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const {
  setDefaultCmsPublishMode,
  setHttpTimeout,
  setAllowUsageTracking,
} = require('../../lib/configOptions');

const i18nKey = 'commands.config.subcommands.set';

exports.command = 'set';
exports.describe = i18n(`${i18nKey}.describe`);

const selectOptions = async () => {
  const { cmsPublishMode } = await promptUser([
    {
      type: 'list',
      look: false,
      name: 'cmsPublishMode',
      pageSize: 20,
      message: i18n(`${i18nKey}.promptMessage`),
      choices: [
        {
          name: 'Default CMS publish mode',
          value: { defaultCmsPublishMode: '' },
        },
        { name: 'Allow usage tracking', value: { allowUsageTracking: '' } },
        { name: 'HTTP timeout', value: { httpTimeout: '' } },
      ],
    },
  ]);

  return cmsPublishMode;
};

const handleConfigUpdate = async (accountId, options) => {
  const { allowUsageTracking, defaultCmsPublishMode, httpTimeout } = options;

  if (typeof defaultCmsPublishMode !== 'undefined') {
    await setDefaultCmsPublishMode({ defaultCmsPublishMode, accountId });
    return true;
  } else if (typeof httpTimeout !== 'undefined') {
    await setHttpTimeout({ httpTimeout, accountId });
    return true;
  } else if (typeof allowUsageTracking !== 'undefined') {
    await setAllowUsageTracking({ allowUsageTracking, accountId });
    return true;
  }

  return false;
};

exports.handler = async options => {
  const { derivedAccountId } = options;

  trackCommandUsage('config-set', null, derivedAccountId);

  const configUpdated = await handleConfigUpdate(derivedAccountId, options);

  if (!configUpdated) {
    const selectedOptions = await selectOptions();

    await handleConfigUpdate(derivedAccountId, selectedOptions);
  }

  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = yargs => {
  yargs
    .options({
      'default-cms-publish-mode': {
        describe: i18n(`${i18nKey}.options.defaultMode.describe`),
        type: 'string',
      },
      'allow-usage-tracking': {
        describe: i18n(`${i18nKey}.options.allowUsageTracking.describe`),
        type: 'boolean',
      },
      'http-timeout': {
        describe: i18n(`${i18nKey}.options.httpTimeout.describe`),
        type: 'string',
      },
    })
    .conflicts('defaultCmsPublishMode', 'allowUsageTracking')
    .conflicts('defaultCmsPublishMode', 'httpTimeout')
    .conflicts('allowUsageTracking', 'httpTimeout')
    .example([['$0 config set', i18n(`${i18nKey}.examples.default`)]]);

  return yargs;
};
