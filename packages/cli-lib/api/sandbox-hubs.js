const http = require('../http');
const SANDBOX_API_PATH = 'sandbox-hubs/v1';
const SANDBOX_API_PATH_V2 = 'sandbox-hubs/v2';

/**
 * Creates a new Sandbox portal instance.
 * @param {String} accountId - Parent portal ID to create the sandbox
 * @param {String} name - Name to use for the sandbox.
 * @param {String} type - Sandbox type (standard | developer).
 * @returns {Object} A new Sandbox portal instance with a pre-generated PAK.
 */
async function createSandbox(accountId, name, type) {
  return http.post(accountId, {
    body: { name, type, generatePersonalAccessKey: true }, // For CLI, generatePersonalAccessKey will always be true since we'll be saving the entry to the config
    timeout: 60000,
    uri: SANDBOX_API_PATH_V2, // Create uses v2 for sandbox type and PAK generation support
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

/**
 * Fetch sandbox usage limits
 * @param {Number} parentAccountId - Parent portal ID.
 * @returns {Object} Object containing limits for each sandbox type
 */
async function getSandboxUsageLimits(parentAccountId) {
  return http.get(parentAccountId, {
    uri: `${SANDBOX_API_PATH}/parent/${parentAccountId}/usage`,
  });
}

module.exports = {
  createSandbox,
  deleteSandbox,
  getSandboxUsageLimits,
};
