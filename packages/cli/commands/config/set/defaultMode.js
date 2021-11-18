const { logger } = require('@hubspot/cli-lib/logger');
const { updateDefaultMode } = require('@hubspot/cli-lib/lib/config');
const inquirer = require('inquirer');
const { Mode } = require('@hubspot/cli-lib');
const { commaSeparatedValues } = require('@hubspot/cli-lib/lib/text');

const { getAccountId } = require('../../../lib/commonOpts');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../../lib/validation');

const ALL_MODES = Object.values(Mode);

const selectMode = async () => {
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      look: false,
      name: 'mode',
      pageSize: 20,
      message: 'Select a mode to use as the default',
      choices: ALL_MODES,
      default: Mode.publish,
    },
  ]);

  return mode;
};

exports.command = 'default-mode [newDefault]';
exports.describe = 'Change default mode used in config';

exports.handler = async options => {
  await loadAndValidateOptions(options);

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
    logger.info(
      `The mode ${specifiedNewDefault} is invalid. Valid values are ${commaSeparatedValues(
        ALL_MODES
      )}.`
    );
    newDefault = await selectMode();
  }

  updateDefaultMode(newDefault);

  return logger.log(`Default mode updated to: ${newDefault}`);
};

exports.builder = yargs => {
  yargs.positional('newMode', {
    describe: 'Mode to use as the default',
    type: 'string',
  });

  yargs.example([
    [
      '$0 config set default-mode',
      'Select mode to use as the default from a list',
    ],
    [
      '$0 config set default-mode publish',
      'Set the default mode in the config to "publish"',
    ],
    [
      '$0 config set default-mode draft',
      'Set the default mode in the config to "draft"',
    ],
  ]);

  return yargs;
};
