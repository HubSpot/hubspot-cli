const { ALLOWED_EXTENSIONS, Mode, DEFAULT_MODE } = require('./lib/constants');
const {
  getAndLoadConfigIfNeeded,
  getConfig,
  getConfigPath,
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
const { checkAndWarnGitInclusion } = require('./lib/git');
const { hasUploadErrors, uploadFolder } = require('./lib/uploadFolder');
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
  getConfigPath,
  findConfig,
  loadConfig,
  loadConfigFromEnvironment,
  getEnv,
  getAccountConfig,
  getAccountId,
  getPortalConfig: getAccountConfig,
  getPortalId: getAccountId,
  hasUploadErrors,
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
