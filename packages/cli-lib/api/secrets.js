const http = require('../http');

const SECRETS_API_PATH = 'cms/v3/functions/secrets';

async function addSecret(accountId, key, value) {
  return http.post(accountId, {
    uri: SECRETS_API_PATH,
    body: {
      key,
      secret: value,
    },
  });
}

async function updateSecret(accountId, key, value) {
  return http.put(accountId, {
    uri: SECRETS_API_PATH,
    body: {
      key,
      secret: value,
    },
  });
}

async function deleteSecret(accountId, key) {
  return http.delete(accountId, {
    uri: `${SECRETS_API_PATH}/${key}`,
  });
}

async function fetchSecrets(accountId) {
  return http.get(accountId, {
    uri: `${SECRETS_API_PATH}`,
  });
}

module.exports = {
  addSecret,
  updateSecret,
  deleteSecret,
  fetchSecrets,
};
