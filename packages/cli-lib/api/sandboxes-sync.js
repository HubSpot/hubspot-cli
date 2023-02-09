const http = require('../http');
const SANDBOXES_SYNC_API_PATH = 'sandboxes-sync/v1';

// fromHubId is the parent portal here, which is required as the first param. Parent account key can only run the sync
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

async function fetchTaskStatus(accountId, taskId) {
  return http.get(accountId, {
    uri: `${SANDBOXES_SYNC_API_PATH}/tasks/${taskId}`,
  });
}

async function fetchTypes(toHubId) {
  return http.get(toHubId, {
    uri: `${SANDBOXES_SYNC_API_PATH}/types/${
      toHubId ? `?toHubId=${toHubId}` : ''
    }`,
  });
}

module.exports = {
  initiateSync,
  fetchTaskStatus,
  fetchTypes,
};
