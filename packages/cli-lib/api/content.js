const http = require('../http');
const CONTENT_API_PATH = 'content/api/v4';

async function fetchContent(accountId, query = {}) {
  return http.get(accountId, {
    uri: `${CONTENT_API_PATH}/contents`,
    query,
  });
}

module.exports = {
  fetchContent,
};
