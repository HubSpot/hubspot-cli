const { EXIT_CODES } = require('../cli/lib/enums/exitCodes');
const { createSandbox: _createSandbox } = require('./api/sandbox-hubs');
const { logger } = require('./logger');

/**
 * Creates a new Sandbox portal instance.
 * @param {String} name - Name to use for the sandbox.
 * @returns {Object} A new Sandbox portal instance.
 */
async function createSandbox(accountId, name) {
  let resp;

  try {
    resp = await _createSandbox(accountId, name);
  } catch (err) {
    logger.error(err.error.message);
    process.exit(EXIT_CODES.ERROR);
  }

  return {
    name,
    ...resp,
  };
}

module.exports = {
  createSandbox,
};
