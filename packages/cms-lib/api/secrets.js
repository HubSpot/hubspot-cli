const http = require('../http');

const SECRETS_API_PATH = 'cms-functions/v1/secrets';

async function addSecret(portalId, key, value) {
  return http.post(portalId, {
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

module.exports = {
  addSecret,
  deleteSecret,
};
