const { VALIDATION_RESULT } = require('../constants');

class RelativeValidator {
  constructor({ name, key }) {
    this.name = name;
    this.key = key;
  }

  clearRelativePath() {
    this._relativePath = null;
  }

  setRelativePath(path) {
    this._relativePath = path;
  }

  getRelativePath() {
    return this._relativePath;
  }

  getSuccess() {
    return {
      validatorKey: this.key,
      validatorName: this.name,
      result: VALIDATION_RESULT.SUCCESS,
    };
  }

  getError(errorObj, file, extraContext = {}) {
    const relativeFilePath = this.getRelativePath();
    const context = {
      filePath: relativeFilePath,
      ...extraContext,
    };
    return {
      validatorKey: this.key,
      validatorName: this.name,
      error: errorObj.getCopy(context),
      result: errorObj.severity || VALIDATION_RESULT.FATAL,
      key: `${this.key}.${errorObj.key}`,
      context,
    };
  }
}

module.exports = RelativeValidator;
