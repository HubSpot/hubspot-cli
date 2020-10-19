const { ALLOWED_EXTENSIONS, Mode, DEFAULT_MODE } = require('./lib/constants');
const {
  checkAndWarnGitInclusion,
  getAndLoadConfigIfNeeded,
  getConfig,
  getPortalId,
  getPortalConfig,
  findConfig,
  loadConfig,
  loadConfigFromEnvironment,
  updatePortalConfig,
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
  getPortalConfig,
  getPortalId,
  updatePortalConfig,
  uploadFolder,
  validateConfig,
  isTrackingAllowed,
  watch,
  walk,
};
