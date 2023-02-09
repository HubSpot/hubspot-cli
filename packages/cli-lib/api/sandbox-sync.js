const http = require('../http');
const SANDBOXES_SYNC_API_PATH = 'sandboxes-sync/v1';

async function initiateSync(fromHubId, toHubId, tasks, sandboxHubId) {
  return http.post('tasks/initiate/async', {
    body: {
      command: 'SYNC',
      fromHubId,
      toHubId,
      sandboxHubId,
      ...tasks,
    },
    timeout: 60000,
    uri: SANDBOXES_SYNC_API_PATH,
  });
}

async function fetchTaskStatus(taskId) {
  return http.get(`tasks/${taskId}`, {
    uri: SANDBOXES_SYNC_API_PATH,
  });
}

async function fetchTypes(toHubId) {
  return http.get(`types/${toHubId ? `?toHubId=${toHubId}` : ''}`, {
    uri: SANDBOXES_SYNC_API_PATH,
  });
}

module.exports = {
  initiateSync,
  fetchTaskStatus,
  fetchTypes,
};
