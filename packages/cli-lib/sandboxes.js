const { createSandbox: _createSandbox } = require('./api/sandbox-hubs');

/**
 * Creates a new Sandbox portal instance.
 * @param {String} name - Name to use for the sandbox.
 * @returns {Object} A new Sandbox portal instance.
 */
async function createSandbox(accountId, name) {
  const resp = await _createSandbox(accountId, name);
  return {
    name,
    ...resp,
  };
}

module.exports = {
  createSandbox,
};
