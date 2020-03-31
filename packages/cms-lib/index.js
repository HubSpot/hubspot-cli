const { ALLOWED_EXTENSIONS, Mode, DEFAULT_MODE } = require('./lib/constants');
const {
  checkAndWarnGitInclusion,
  getAndLoadConfigIfNeeded,
  getConfig,
  getPortalId,
  getPortalConfig,
  loadConfig,
  loadConfigFromEnvironment,
  updatePortalConfig,
  validateConfig,
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
  loadConfig,
  loadConfigFromEnvironment,
  getPortalConfig,
  getPortalId,
  updatePortalConfig,
  uploadFolder,
  validateConfig,
  watch,
  walk,
};
