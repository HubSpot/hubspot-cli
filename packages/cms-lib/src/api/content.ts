import * as http from '../http';
const CONTENT_API_PATH = 'content/api/v4';

export async function fetchContent(portalId, query = {}) {
  return http.get(portalId, {
    uri: `${CONTENT_API_PATH}/contents`,
    query,
  });
}
