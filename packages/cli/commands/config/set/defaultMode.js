const { logger } = require('@hubspot/cli-lib/logger');
const { updateDefaultMode } = require('@hubspot/cli-lib/lib/config');
const inquirer = require('inquirer');
const {
  Mode,
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { commaSeparatedValues } = require('@hubspot/cli-lib/lib/text');

const { getAccountId, setLogLevel } = require('../../../lib/commonOpts');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { logDebugInfo } = require('../../../lib/debugInfo');
const { validateAccount } = require('../../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.config.subcommands.set.subcommands.defaultMode';

const ALL_MODES = Object.values(Mode);

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

const selectMode = async () => {
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      look: false,
      name: 'mode',
      pageSize: 20,
      message: i18n(`${i18nKey}.promptMessage`),
      choices: ALL_MODES,
      default: Mode.publish,
    },
  ]);

  return mode;
};

exports.command = 'default-mode [newDefault]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const { newMode: specifiedNewDefault } = options;
  let newDefault;

  trackCommandUsage('config-set-default-mode', {}, accountId);

  if (!specifiedNewDefault) {
    newDefault = await selectMode();
  } else if (
    specifiedNewDefault &&
    ALL_MODES.find(m => m === specifiedNewDefault)
  ) {
    newDefault = specifiedNewDefault;
  } else {
    logger.error(
      i18n(`${i18nKey}.errors.invalidMode`, {
        mode: specifiedNewDefault,
        validModes: commaSeparatedValues(ALL_MODES),
      })
    );
    newDefault = await selectMode();
  }

  updateDefaultMode(newDefault);

  return logger.success(
    i18n(`${i18nKey}.success.modeUpdated`, {
      mode: newDefault,
    })
  );
};

exports.builder = yargs => {
  yargs.positional('newMode', {
    describe: i18n(`${i18nKey}.positionals.newMode.describe`),
    type: 'string',
  });

  yargs.example([
    ['$0 config set default-mode', i18n(`${i18nKey}.examples.default`)],
    ['$0 config set default-mode publish', i18n(`${i18nKey}.examples.publish`)],
    ['$0 config set default-mode draft', i18n(`${i18nKey}.examples.draft`)],
  ]);

  return yargs;
};
