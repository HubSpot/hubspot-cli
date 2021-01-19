const { logger } = require('@hubspot/cli-lib/logger');
const {
  AWS_RESERVED_VARS,
  AWS_RESERVED_VARS_INFO_URL,
} = require('./constants');

const loadEnvironmentVariables = (
  globalEnvironment = {},
  localEnvironment = {}
) => {
  Object.keys(globalEnvironment).forEach(globalEnvironmentVariable => {
    if (AWS_RESERVED_VARS.indexOf(globalEnvironmentVariable) !== -1) {
      logger.warn(
        `The variable ${globalEnvironmentVariable} is a reserved AWS variable and should not be used. See ${AWS_RESERVED_VARS_INFO_URL} for more info.`
      );
    }

    logger.debug(
      `Setting environment variable(global) ${globalEnvironmentVariable} to ${localEnvironment[globalEnvironmentVariable]}.`
    );
    process.env[globalEnvironmentVariable] =
      globalEnvironment[globalEnvironmentVariable];
  });

  Object.keys(localEnvironment).forEach(localEnvironmentVariable => {
    if (AWS_RESERVED_VARS.indexOf(localEnvironmentVariable) !== -1) {
      logger.warn(
        `The variable ${localEnvironmentVariable} is a reserved AWS variable and should not be used. See ${AWS_RESERVED_VARS_INFO_URL} for more info.`
      );
    }

    logger.debug(
      `Setting environment variable(local) ${localEnvironmentVariable} to ${localEnvironment[localEnvironmentVariable]}.`
    );
    process.env[localEnvironmentVariable] =
      localEnvironment[localEnvironmentVariable];
  });
};

module.exports = {
  loadEnvironmentVariables,
};
