const {
  configFileExists,
  configFileIsBlank,
  getAndLoadConfigIfNeeded,
} = require('./file');
const { Mode } = require('../constants');

const isTrackingAllowed = () => {
  if (!configFileExists() || configFileIsBlank()) {
    return true;
  }
  const { allowUsageTracking } = getAndLoadConfigIfNeeded();
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
