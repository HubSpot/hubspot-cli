/* eslint-disable no-useless-catch */
const { EXIT_CODES } = require('../cli/lib/enums/exitCodes');
const {
  createSandbox: _createSandbox,
  deleteSandbox: _deleteSandbox,
} = require('./api/sandbox-hubs');
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
    throw err;
  }

  return {
    name,
    ...resp,
  };
}

async function deleteSandbox(parentAccountId, sandboxAccountId) {
  let resp;

  try {
    resp = await _deleteSandbox(parentAccountId, sandboxAccountId);
  } catch (err) {
    logger.error(err.error.message);
    process.exit(EXIT_CODES.ERROR);
  }

  return {
    parentAccountId,
    sandboxAccountId,
    ...resp,
  };
}

module.exports = {
  createSandbox,
  deleteSandbox,
};
