const { ALLOWED_EXTENSIONS, Mode, DEFAULT_MODE } = require('./lib/constants');
const {
  checkAndWarnGitInclusion,
  getAndLoadConfigIfNeeded,
  getConfig,
  getAccountId,
  getAccountConfig,
  findConfig,
  loadConfig,
  loadConfigFromEnvironment,
  updateAccountConfig,
  validateConfig,
  isTrackingAllowed,
} = require('./lib/config');
const { uploadFolder } = require('./lib/uploadFolder');
const { watch } = require('./lib/watch');
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
  getAccountConfig,
  getAccountId,
  getPortalConfig: getAccountConfig,
  getPortalId: getAccountId,
  updateAccountConfig,
  updatePortalConfig: updateAccountConfig,
  uploadFolder,
  validateConfig,
  isTrackingAllowed,
  watch,
  walk,
};
