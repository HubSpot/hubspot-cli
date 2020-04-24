import * as http from '../http';

const BLOGS_API_PATH = 'blogs/v3';

export async function fetchBlogs(portalId, query = {}) {
  return http.get(portalId, {
    uri: `${BLOGS_API_PATH}/blogs`,
    query,
  });
}
