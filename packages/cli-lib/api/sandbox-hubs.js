const http = require('../http');
const SANDBOX_API_PATH = 'sandbox-hubs/v1';

async function createSandbox(accountId, name) {
  return http.post(accountId, {
    data: { name },
    url: SANDBOX_API_PATH,
  });
}

module.exports = {
  createSandbox,
};
