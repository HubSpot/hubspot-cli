const { Mode } = require('../constants');
const main = require('./file');

const isTrackingAllowed = () => {
  if (!main.configFileExists() || main.configFileIsBlank()) {
    return true;
  }
  const { allowUsageTracking } = main.getAndLoadConfigIfNeeded();
  return allowUsageTracking !== false;
};

/**
 * Returns mode(draft/publish) or undefined if invalid mode
 * @param {string} mode
 */
const getMode = mode => {
  return Mode[mode && mode.toLowerCase()];
};

module.exports = {
  getMode,
  isTrackingAllowed,
};
