const http = require('../http');
const BLOGS_API_PATH = 'blogs/v3';

async function fetchBlogs(accountId, query = {}) {
  return http.get(accountId, {
    url: `${BLOGS_API_PATH}/blogs`,
    query,
  });
}

module.exports = {
  fetchBlogs,
};
