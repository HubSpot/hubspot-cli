const http = require('../http');
const SANDBOX_API_PATH = 'sandbox-hubs/v1';

/**
 * Creates a new Sandbox portal instance.
 * @param {String} accountId - Parent portal ID to create the sandbox
 * @param {String} name - Name to use for the sandbox.
 * @returns {Object} A new Sandbox portal instance.
 */
async function createSandbox(accountId, name) {
  return http.post(accountId, {
    body: { name },
    timeout: 60000,
    uri: SANDBOX_API_PATH,
  });
}

/**
 * Deletes a Sandbox portal instance.
 * @param {Number} parentAccountId - Parent portal ID.
 * @param {Number} sandboxAccountId - Sandbox portal ID.
 * @returns {200}
 */
async function deleteSandbox(parentAccountId, sandboxAccountId) {
  return http.delete(parentAccountId, {
    uri: `${SANDBOX_API_PATH}/${sandboxAccountId}`,
  });
}

module.exports = {
  createSandbox,
  deleteSandbox,
};
