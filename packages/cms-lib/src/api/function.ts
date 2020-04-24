import * as http from '../http';

const FUNCTION_API_PATH = 'cms/v3/functions/function';

export async function getFunctionByPath(portalId, functionPath) {
  return http.get(portalId, {
    uri: `${FUNCTION_API_PATH}/by-path/${functionPath}`,
  });
}
