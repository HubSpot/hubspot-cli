const http = require('../http');

const FUNCTION_API_PATH = 'cms-functions/v1/function';

async function getFunctionByPath(portalId, functionPath) {
  return http.get(portalId, {
    uri: `${FUNCTION_API_PATH}/by-path/${functionPath}`,
  });
}

module.exports = {
  getFunctionByPath,
};
