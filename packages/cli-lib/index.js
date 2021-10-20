const { ALLOWED_EXTENSIONS, Mode, DEFAULT_MODE } = require('./lib/constants');
const {
  checkAndWarnGitInclusion,
  getAndLoadConfigIfNeeded,
  getConfig,
  getAccount,
  getAccountId,
  getAccountConfig,
  getEnv,

  findConfig,
  loadConfig,
  loadConfigFromEnvironment,
  updateAccountConfig,
  validateConfig,
  isConfigFlagEnabled,
  isTrackingAllowed,
  writeConfig,
} = require('./lib/config');
const { uploadFolder } = require('./lib/uploadFolder');
const { watch } = require('./lib/watch');
const { read } = require('./lib/read');
const { walk } = require('./lib/walk');

module.exports = {
  ALLOWED_EXTENSIONS,
  DEFAULT_MODE,
  Mode,
  checkAndWarnGitInclusion,
  getAndLoadConfigIfNeeded,
  getConfig,
  findConfig,
  loadConfig,
  loadConfigFromEnvironment,
  getEnv,
  getAccount,
  getAccountConfig,
  getAccountId,
  getPortalConfig: getAccountConfig,
  getPortalId: getAccountId,
  updateAccountConfig,
  updatePortalConfig: updateAccountConfig,
  uploadFolder,
  validateConfig,
  isTrackingAllowed,
  isConfigFlagEnabled,
  watch,
  walk,
  writeConfig,
  read,
};
