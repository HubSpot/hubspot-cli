const { Mode } = require('../constants');

/**
 * Returns mode(draft/publish) or undefined if invalid mode
 * @param {string} mode
 */
const getMode = mode => {
  return Mode[mode && mode.toLowerCase()];
};

module.exports = {
  getMode,
};
