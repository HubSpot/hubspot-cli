const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('../../lib/lang');
const { getAccountId } = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { setDefaultMode } = require('./set/defaultMode');
const { setHttpTimeout } = require('./set/httpTimeout');
const { setAllowUsageTracking } = require('./set/allowUsageTracking');

const i18nKey = 'cli.commands.config.subcommands.set';

exports.command = 'set';
exports.describe = i18n(`${i18nKey}.describe`);

const selectOptions = async () => {
  const { mode } = await promptUser([
    {
      type: 'list',
      look: false,
      name: 'mode',
      pageSize: 20,
      message: i18n(`${i18nKey}.promptMessage`),
      choices: [
        { name: 'Default mode', value: { defaultMode: '' } },
        { name: 'Allow usage tracking', value: { allowUsageTracking: '' } },
        { name: 'HTTP timeout', value: { httpTimeout: '' } },
      ],
    },
  ]);

  return mode;
};

const handleConfigUpdate = async (accountId, options) => {
  const { allowUsageTracking, defaultMode, httpTimeout } = options;

  if (typeof defaultMode !== 'undefined') {
    await setDefaultMode({ defaultMode, accountId });
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
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('config-set', null, accountId);

  const configUpdated = await handleConfigUpdate(accountId, options);

  if (!configUpdated) {
    const selectedOptions = await selectOptions();

    await handleConfigUpdate(accountId, selectedOptions);
  }

  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = yargs => {
  yargs
    .options({
      defaultMode: {
        describe: i18n(`${i18nKey}.options.defaultMode.describe`),
        type: 'string',
      },
      allowUsageTracking: {
        describe: i18n(`${i18nKey}.options.allowUsageTracking.describe`),
        type: 'boolean',
      },
      httpTimeout: {
        describe: i18n(`${i18nKey}.options.httpTimeout.describe`),
        type: 'string',
      },
    })
    .conflicts('defaultMode', 'allowUsageTracking')
    .conflicts('defaultMode', 'httpTimeout')
    .conflicts('allowUsageTracking', 'httpTimeout');

  yargs.example([['$0 config set', i18n(`${i18nKey}.examples.default`)]]);

  //TODO remove this when "hs accounts use" is fully rolled out
  yargs.strict(false);

  return yargs;
};
