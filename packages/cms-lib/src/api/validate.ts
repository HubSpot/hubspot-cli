import * as http from '../http';

const HUBL_VALIDATE_API_PATH = 'cos-rendering/v1/internal/validate';

/**
 * @async
 * @param {number} portalId
 * @param {string} sourceCode
 * @param {object} hublValidationOptions
 * @returns {Promise}
 */
export async function validateHubl(
  portalId,
  sourceCode,
  hublValidationOptions
) {
  return http.post(portalId, {
    uri: HUBL_VALIDATE_API_PATH,
    body: {
      template_source: sourceCode,
      ...hublValidationOptions,
    },
  });
}
