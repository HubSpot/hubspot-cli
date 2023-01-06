const http = require('../http');
const SANDBOX_API_PATH = 'sandbox-hubs/v1';

async function createSandbox(accountId, name) {
  return http.post(accountId, {
    body: { name },
    timeout: 60000,
    uri: SANDBOX_API_PATH,
  });
}

async function deleteSandbox(parentAccountId, sandboxAccountId) {
  return http.delete(parentAccountId, {
    uri: `${SANDBOX_API_PATH}/${sandboxAccountId}`,
  });
}

module.exports = {
  createSandbox,
  deleteSandbox,
};
