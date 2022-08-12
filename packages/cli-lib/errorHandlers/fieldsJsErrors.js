const { logger } = require('../logger');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const i18nKey = 'cli.commands.upload';

const FieldErrors = {
  IsNotFunction: 'IsNotFunction',
  DoesNotReturnArray: 'DoesNotReturnArray',
};

function logFieldsJsError(e, filePath) {
  const logFieldError = errCode => {
    logger.error(i18n(`${i18nKey}.errors.${errCode}`, { path: filePath }));
  };
  if (e instanceof SyntaxError || e.code === 'MODULE_NOT_FOUND') {
    logFieldError('fieldsJsSyntaxError');
  }
  if (e === FieldErrors.IsNotFunction) {
    logFieldError('fieldsJsNotFunction');
  }
  if (e === FieldErrors.DoesNotReturnArray) {
    logFieldError('fieldsJsNotReturnArray');
  }
  if (e.code === 'ENOENT') {
    logFieldError('invalidPath');
  }
}

module.exports = { FieldErrors, logFieldsJsError };
