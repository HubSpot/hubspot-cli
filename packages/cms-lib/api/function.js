const http = require('../http');

const FUNCTION_API_PATH = 'cms/v3/functions/function';

async function getFunctionByPath(accountId, functionPath) {
  return http.get(accountId, {
    uri: `${FUNCTION_API_PATH}/by-path/${functionPath}`,
  });
}

module.exports = {
  getFunctionByPath,
};
