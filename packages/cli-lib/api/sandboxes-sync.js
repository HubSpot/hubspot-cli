const http = require('../http');
const SANDBOXES_SYNC_API_PATH = 'sandboxes-sync/v1';

/**
 * Initiate a sync to a Sandbox portal.
 * @param {Number} fromHubId - Source account for the sync
 * @param {Number} toHubId - Target account for the sync
 * @param {Array} tasks - Array of objects containing a type {Name} and portableKeys {Array}
 * @param {Number} sandboxHubId - Sandbox portal ID for the sync, required by API
 * @returns {Object} A new Sandbox portal instance.
 */
async function initiateSync(fromHubId, toHubId, tasks, sandboxHubId) {
  return http.post(fromHubId, {
    body: {
      command: 'SYNC',
      fromHubId,
      toHubId,
      sandboxHubId,
      tasks,
    },
    timeout: 60000,
    uri: `${SANDBOXES_SYNC_API_PATH}/tasks/initiate/async`,
  });
}

/**
 * Fetches a task.
 * @param {String} accountId - Parent account ID.
 * @param {String} taskId - Sync task ID.
 * @returns {Object} a sync task instance.
 */
async function fetchTaskStatus(accountId, taskId) {
  return http.get(accountId, {
    uri: `${SANDBOXES_SYNC_API_PATH}/tasks/${taskId}`,
  });
}

/**
 * Fetches available sync types for a specified portal (toHubId).
 * @param {Number} accountId - Parent portal ID needed to satisfy endpoint requirements.
 * @param {Number} toHubId - Portal ID to fetch available types.
 * @returns {Object} a list of available sync types
 */
async function fetchTypes(accountId, toHubId) {
  return http.get(accountId, {
    uri: `${SANDBOXES_SYNC_API_PATH}/types${
      toHubId ? `?toHubId=${toHubId}` : ''
    }`,
  });
}

module.exports = {
  initiateSync,
  fetchTaskStatus,
  fetchTypes,
};
