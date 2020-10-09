const http = require('../http');

const HUBL_VALIDATE_API_PATH = 'cos-rendering/v1/internal/validate';

/**
 * @async
 * @param {number} accountId
 * @param {string} sourceCode
 * @param {object} hublValidationOptions
 * @returns {Promise}
 */
async function validateHubl(accountId, sourceCode, hublValidationOptions) {
  return http.post(accountId, {
    uri: HUBL_VALIDATE_API_PATH,
    body: {
      template_source: sourceCode,
      ...hublValidationOptions,
    },
  });
}

module.exports = {
  validateHubl,
};
