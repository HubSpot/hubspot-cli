const http = require('../http');

const FUNCTIONS_API_PATH = 'cms-functions/v1/functions';

async function getFunctionByPath(portalId, functionPath) {
  return http.post(portalId, {
    uri: FUNCTIONS_API_PATH,
    body: {
      path: functionPath,
    },
  });
}

module.exports = {
  getFunctionByPath,
};
