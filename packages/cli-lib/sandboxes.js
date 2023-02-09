/* eslint-disable no-useless-catch */
const {
  createSandbox: _createSandbox,
  deleteSandbox: _deleteSandbox,
} = require('./api/sandbox-hubs');
const {
  initiateSync: _initiateSync,
  fetchTaskStatus: _fetchTaskStatus,
  fetchTypes: _fetchTypes,
} = require('./api/sandbox-hubs');

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

/**
 * Deletes a Sandbox portal instance.
 * @param {Number} parentAccountId - Parent portal ID.
 * @param {Number} sandboxAccountId - Sandbox portal ID.
 * @returns {200}
 */
async function deleteSandbox(parentAccountId, sandboxAccountId) {
  let resp;

  try {
    resp = await _deleteSandbox(parentAccountId, sandboxAccountId);
  } catch (err) {
    throw err;
  }

  return {
    parentAccountId,
    sandboxAccountId,
    ...resp,
  };
}

/**
 * Initiate a sync to a Sandbox portal.
 * @param {Number} fromHubId - Source account for the sync
 * @param {Number} toHubId - Target account for the sync
 * @param {Array} tasks - Array of objects containing a type {Name} and portableKeys {Array}
 * @param {Number} sandboxHubId - Sandbox portal ID for the sync
 * @returns {Object} A new Sandbox portal instance.
 */
async function initiateSync(fromHubId, toHubId, tasks, sandboxHubId) {
  let resp;

  try {
    resp = await _initiateSync(fromHubId, toHubId, tasks, sandboxHubId);
  } catch (err) {
    throw err;
  }

  return {
    ...resp,
  };
}

/**
 * Deletes a Sandbox portal instance.
 * @param {String} taskId - Sync task ID.
 * @returns {200}
 */
async function fetchTaskStatus(taskId) {
  let resp;

  try {
    resp = await _fetchTaskStatus(taskId);
  } catch (err) {
    throw err;
  }

  return {
    ...resp,
  };
}

/**
 * Deletes a Sandbox portal instance.
 * @param {Number} toHubId - Portal ID to fetch available types.
 * @returns {200}
 */
async function fetchTypes(toHubId) {
  let resp;

  try {
    resp = await _fetchTypes(toHubId);
  } catch (err) {
    throw err;
  }

  return {
    toHubId,
    ...resp,
  };
}

module.exports = {
  createSandbox,
  deleteSandbox,
  initiateSync,
  fetchTaskStatus,
  fetchTypes,
};
