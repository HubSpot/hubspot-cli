const {
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  getAndLoadConfigIfNeeded,
  getConfig,
  getConfigPath,
  loadConfig,
  setConfig,
} = require('./file');
const {
  getPortalConfig,
  getPortalId,
  getPortalName,
  updatePortalConfig,
  updateDefaultPortal,
} = require('./portal');
const { isTrackingAllowed } = require('./helpers');

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
