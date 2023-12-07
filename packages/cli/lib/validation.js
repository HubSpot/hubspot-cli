const { logger } = require('@hubspot/cli-lib/logger');
const { Mode, checkAndWarnGitInclusion } = require('@hubspot/cli-lib');
const {
  API_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('@hubspot/cli-lib/lib/constants');
const { commaSeparatedValues } = require('@hubspot/local-dev-lib/text');
const {
  loadConfig,
  getConfigPath,
  validateConfig,
  getAccountConfig,
  loadConfigFromEnvironment,
} = require('@hubspot/local-dev-lib/config');
const { getAbsoluteFilePath } = require('@hubspot/local-dev-lib/path');
const { getOauthManager } = require('@hubspot/cli-lib/oauth');
const {
  accessTokenForPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');
const { getCwd, getExt } = require('@hubspot/local-dev-lib/path');
const { getAccountId, getMode, setLogLevel } = require('./commonOpts');
const { logDebugInfo } = require('./debugInfo');
const fs = require('fs');
const path = require('path');
const { EXIT_CODES } = require('./enums/exitCodes');

async function loadAndValidateOptions(options, shouldValidateAccount = true) {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion(getConfigPath());

  let validAccount = true;
  if (shouldValidateAccount) {
    validAccount = await validateAccount(options);
  }

  if (!(validateConfig() && validAccount)) {
    process.exit(EXIT_CODES.ERROR);
  }
}

/**
 * Validate that an account was passed to the command and that the account's configuration is valid
 *
 *
 * @param {object} command options
 * @returns {boolean}
 */
async function validateAccount(options) {
  const accountId = getAccountId(options);
  const {
    portalId: portalIdOption,
    portal: portalOption,
    accountId: _accountIdOption,
    account: _accountOption,
  } = options;
  const accountOption = portalOption || _accountOption;
  const accountIdOption = portalIdOption || _accountIdOption;

  if (!accountId) {
    if (accountOption) {
      logger.error(
        `The account "${accountOption}" could not be found in the config`
      );
    } else if (accountIdOption) {
      logger.error(
        `The account "${accountIdOption}" could not be found in the config`
      );
    } else {
      logger.error(
        'An account needs to be supplied either via "--account" or through setting a "defaultPortal"'
      );
    }
    return false;
  }

  if (accountOption && loadConfigFromEnvironment()) {
    throw new Error(
      'Cannot specify an account when environment variables are supplied. Please unset the environment variables or do not use the "--account" flag.'
    );
  }

  const accountConfig = getAccountConfig(accountId);
  if (!accountConfig) {
    logger.error(`The account ${accountId} has not been configured`);
    return false;
  }

  const { authType, auth, apiKey, personalAccessKey } = accountConfig;

  if (typeof authType === 'string' && authType !== authType.toLowerCase()) {
    logger.error(
      `Invalid "authType" value "${authType}" for account "${accountId}" in config file: ${getConfigPath()}. Valid values are ${commaSeparatedValues(
        [
          PERSONAL_ACCESS_KEY_AUTH_METHOD,
          OAUTH_AUTH_METHOD,
          API_KEY_AUTH_METHOD,
        ].map(method => method.value)
      )}.`
    );
  }

  if (authType === 'oauth2') {
    if (typeof auth !== 'object') {
      logger.error(
        `The OAuth2 auth configuration for account ${accountId} is missing`
      );
      return false;
    }

    const { clientId, clientSecret, tokenInfo } = auth;

    if (!clientId || !clientSecret || !tokenInfo || !tokenInfo.refreshToken) {
      logger.error(
        `The OAuth2 configuration for account ${accountId} is incorrect`
      );
      logger.error('Run "hscms auth oauth2" to reauthenticate');
      return false;
    }

    const oauth = getOauthManager(accountId, accountConfig);
    try {
      const accessToken = await oauth.accessToken();
      if (!accessToken) {
        logger.error(
          `The OAuth2 access token could not be found for accountId ${accountId}`
        );
        return false;
      }
    } catch (e) {
      logger.error(e.message);
      return false;
    }
  } else if (authType === 'personalaccesskey') {
    if (!personalAccessKey) {
      logger.error(
        `The account "${accountId}" is configured to use a access key for authentication and is missing a "personalAccessKey" in the configuration file`
      );
      return false;
    }

    try {
      const accessToken = await accessTokenForPersonalAccessKey(accountId);
      if (!accessToken) {
        logger.error(
          `An OAuth2 access token for account "${accountId} could not be retrieved using the "personalAccessKey" provided`
        );
        return false;
      }
    } catch (e) {
      logger.error(e.message);
      return false;
    }
  } else if (!apiKey) {
    logger.error(
      `The accountId ${accountId} is missing authentication configuration`
    );
    return false;
  }

  return true;
}

/**
 * @param {object} command options
 * @returns {boolean}
 */
function validateMode(options) {
  const mode = getMode(options);
  if (Mode[mode]) {
    return true;
  }
  const modesMessage = `Available modes are: ${Object.values(Mode).join(
    ', '
  )}.`;
  if (mode != null) {
    logger.error([`The mode "${mode}" is invalid.`, modesMessage].join(' '));
  } else {
    logger.error(['The mode option is missing.', modesMessage].join(' '));
  }
  return false;
}

const fileExists = _path => {
  let isFile;
  try {
    const absoluteSrcPath = path.resolve(getCwd(), _path);
    if (!absoluteSrcPath) return false;

    const stats = fs.statSync(absoluteSrcPath);
    isFile = stats.isFile();

    if (!isFile) {
      logger.error(`The path "${_path}" is not a path to a file`);
      return false;
    }
  } catch (e) {
    logger.error(`The path "${_path}" is not a path to a file`);
    return false;
  }

  return true;
};

const isFileValidJSON = _path => {
  const filePath = getAbsoluteFilePath(_path);
  if (!fileExists(filePath)) return false;

  if (getExt(_path) !== 'json') {
    logger.error(`The file "${_path}" must be a valid JSON file`);
    return false;
  }

  try {
    JSON.parse(fs.readFileSync(filePath));
  } catch (e) {
    logger.error(`The file "${_path}" contains invalid JSON`);
    return false;
  }

  return true;
};

module.exports = {
  validateMode,
  validateAccount,
  isFileValidJSON,
  fileExists,
  loadAndValidateOptions,
};
