const http = require('../http');

const SECRETS_API_PATH = 'cms/v3/functions/secrets';

async function addSecret(portalId, key, value) {
  return http.post(portalId, {
    uri: SECRETS_API_PATH,
    body: {
      key,
      secret: value,
    },
  });
}

async function updateSecret(portalId, key, value) {
  return http.put(portalId, {
    uri: SECRETS_API_PATH,
    body: {
      key,
      secret: value,
    },
  });
}

async function deleteSecret(portalId, key) {
  return http.delete(portalId, {
    uri: `${SECRETS_API_PATH}/${key}`,
  });
}

async function fetchSecrets(portalId) {
  return http.get(portalId, {
    uri: `${SECRETS_API_PATH}`,
  });
}

module.exports = {
  addSecret,
  updateSecret,
  deleteSecret,
  fetchSecrets,
};
