const { VALIDATION_RESULT } = require('../constants');

class BaseValidator {
  getSuccess() {
    return { validator: this.name, result: VALIDATION_RESULT.SUCCESS };
  }

  getError(errorObj, copyPlaceholders = {}) {
    return {
      validator: this.name,
      error: errorObj.getCopy(copyPlaceholders),
      result: errorObj.severity || VALIDATION_RESULT.FATAL,
      key: `${this.key}.${errorObj.key}`,
    };
  }
}

module.exports = BaseValidator;
