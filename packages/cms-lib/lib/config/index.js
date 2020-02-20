const {
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  getAndLoadConfigIfNeeded,
  getConfig,
  getConfigPath,
  isTrackingAllowed,
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

module.exports = {
  // File methods
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  getAndLoadConfigIfNeeded,
  getConfig,
  getConfigPath,
  isTrackingAllowed,
  loadConfig,
  setConfig,

  // Portal methods
  getPortalConfig,
  getPortalId,
  getPortalName,
  updatePortalConfig,
  updateDefaultPortal,
};
