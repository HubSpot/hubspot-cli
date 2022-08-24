const { logger } = require('../logger');
const { i18n } = require('../lib/lang');
const i18nKey = 'cli.commands.upload';

const FieldErrors = {
  IsNotFunction: 'IsNotFunction',
  DoesNotReturnArray: 'DoesNotReturnArray',
};

function logFieldsJsError(e, path, info = {}) {
  const logFieldError = (errCode, options) => {
    logger.error(i18n(`${i18nKey}.errors.${errCode}`, options));
  };
  if (e instanceof SyntaxError || e.code === 'MODULE_NOT_FOUND') {
    logFieldError('fieldsJsSyntaxError', { path });
  }
  if (e === FieldErrors.IsNotFunction) {
    logFieldError('fieldsJsNotFunction', { path, returned: info.returned });
  }
  if (e === FieldErrors.DoesNotReturnArray) {
    logFieldError('fieldsJsNotReturnArray', { path, returned: info.returned });
  }
  if (e.code === 'ENOENT') {
    logFieldError('invalidPath', { path });
  }
}

module.exports = { FieldErrors, logFieldsJsError };
