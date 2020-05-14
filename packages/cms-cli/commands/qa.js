const { initAction } = require('./init');
const { authAction } = require('./auth');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  ENVIRONMENTS,
  SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT,
} = require('@hubspot/cms-lib/lib/constants');

const initDescription = `Initialize ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} for a HubSpot portal in ${ENVIRONMENTS.QA} environment.`;
const authDescription = `Configure authentication for a HubSpot account in ${ENVIRONMENTS.QA} environment. Supported authentication protocols are ${SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT}.`;

function qaCommand(program) {
  program
    .description('Run commands with configuration for QA environment')
    .command('init', initDescription)
    .command('auth', authDescription);
}

function qaInitCommand(program) {
  program.description(initDescription).action(async options => {
    initAction({
      ...options,
      qa: true,
    });
  });
}

function qaAuthCommand(program) {
  program
    .description(authDescription)
    .arguments('<type>')
    .action(async (type, options) => {
      authAction(type, {
        ...options,
        qa: true,
      });
    });
}

module.exports = {
  qaCommand,
  qaInitCommand,
  qaAuthCommand,
};
