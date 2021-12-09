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
    url: HUBL_VALIDATE_API_PATH,
    data: {
      template_source: sourceCode,
      ...hublValidationOptions,
    },
  });
}

module.exports = {
  validateHubl,
};
