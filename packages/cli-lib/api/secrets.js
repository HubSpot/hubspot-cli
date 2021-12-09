const http = require('../http');

const SECRETS_API_PATH = 'cms/v3/functions/secrets';

async function addSecret(accountId, key, value) {
  return http.post(accountId, {
    url: SECRETS_API_PATH,
    data: {
      key,
      secret: value,
    },
  });
}

async function updateSecret(accountId, key, value) {
  return http.put(accountId, {
    url: SECRETS_API_PATH,
    data: {
      key,
      secret: value,
    },
  });
}

async function deleteSecret(accountId, key) {
  return http.delete(accountId, {
    url: `${SECRETS_API_PATH}/${key}`,
  });
}

async function fetchSecrets(accountId) {
  return http.get(accountId, {
    url: `${SECRETS_API_PATH}`,
  });
}

module.exports = {
  addSecret,
  updateSecret,
  deleteSecret,
  fetchSecrets,
};
