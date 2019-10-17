const http = require('../http');
const BLOGS_API_PATH = 'blogs/v3';

async function fetchBlogs(portalId, query = {}) {
  return http.get(portalId, {
    uri: `${BLOGS_API_PATH}/blogs`,
    query,
  });
}

module.exports = {
  fetchBlogs,
};
