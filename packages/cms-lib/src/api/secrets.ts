import * as http from '../http';

const SECRETS_API_PATH = 'cms/v3/functions/secrets';

export async function addSecret(portalId, key, value) {
  return http.post(portalId, {
    uri: SECRETS_API_PATH,
    body: {
      key,
      secret: value,
    },
  });
}

export async function deleteSecret(portalId, key) {
  return http.delete(portalId, {
    uri: `${SECRETS_API_PATH}/${key}`,
  });
}

export async function fetchSecrets(portalId) {
  return http.get(portalId, {
    uri: `${SECRETS_API_PATH}`,
  });
}
