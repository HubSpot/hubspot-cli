const http = require('../http');
const SANDBOX_API_PATH = 'sandbox-hubs/v1';

async function createSandbox(accountId, name) {
  return http.post(accountId, {
    name,
    uri: `${SANDBOX_API_PATH}`,
  });
}

module.exports = {
  createSandbox,
};
