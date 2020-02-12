const http = require('../http');

const FUNCTION_API_PATH = 'cms/v3/functions/function';

async function getFunctionByPath(portalId, functionPath) {
  return http.get(portalId, {
    uri: `${FUNCTION_API_PATH}/by-path/${functionPath}`,
  });
}

module.exports = {
  getFunctionByPath,
};
