const { ALLOWED_EXTENSIONS, Mode, DEFAULT_MODE } = require('./lib/constants');
const {
  loadConfig,
  getAndLoadConfigIfNeeded,
  getConfig,
  getConfigVariablesFromEnv,
  getPortalId,
  getPortalConfig,
  updatePortalConfig,
  validateConfig,
  checkAndWarnGitInclusion,
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
  getConfigVariablesFromEnv,
  loadConfig,
  getPortalConfig,
  getPortalId,
  updatePortalConfig,
  uploadFolder,
  validateConfig,
  watch,
  walk,
};
