const { initializeConfigCommand } = require('../commands/init');
const { configureAuthCommand } = require('../commands/auth');
const { initAction } = require('./init');
const { authAction } = require('./auth');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  ENVIRONMENTS,
  SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT,
} = require('@hubspot/cms-lib/lib/constants');

function qaCommand(program) {
  program
    .description('Run commands with configuration for QA environment')
    .command(
      'init',
      `initialize ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} for a HubSpot portal in ${ENVIRONMENTS.QA} environment`
    )
    .command(
      'auth',
      `Configure authentication for a HubSpot account in ${ENVIRONMENTS.QA} environment. Supported authentication protocols are ${SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT}.`
    );
}

function qaInitCommand(program) {
  program
    .description('run commands with configuration for QA environment')
    .action(async options => {
      initializeConfigCommand(program);
      initAction(options);
    });
}

function qaAuthCommand(program) {
  program
    .description('run commands with configuration for QA environment')
    .action(async options => {
      configureAuthCommand(program);
      authAction(options);
    });
}

module.exports = {
  qaCommand,
  qaInitCommand,
  qaAuthCommand,
};
