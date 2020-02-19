const {
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  getAndLoadConfigIfNeeded,
  getConfig,
  getConfigPath,
  loadConfig,
  setConfig,
} = require('./config/file');
const {
  getPortalConfig,
  getPortalId,
  getPortalName,
  updatePortalConfig,
  updateDefaultPortal,
} = require('./config/portal');
const { isTrackingAllowed } = require('./config/helpers');

module.exports = {
  // File methods
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  getAndLoadConfigIfNeeded,
  getConfig,
  getConfigPath,
  loadConfig,
  setConfig,

  // Portal methods
  getPortalConfig,
  getPortalId,
  getPortalName,
  updatePortalConfig,
  updateDefaultPortal,

  // Helper methods
  isTrackingAllowed,
};
