const path = require('path');

const { VALIDATION_RESULT } = require('../constants');

class BaseValidator {
  constructor({ name, key }) {
    this.name = name;
    this.key = key;
  }

  clearThemePath() {
    this._absoluteThemePath = null;
  }

  setThemePath(path) {
    this._absoluteThemePath = path;
  }

  getRelativePath(filePath) {
    return this._absoluteThemePath
      ? path.relative(this._absoluteThemePath, filePath)
      : filePath;
  }

  getSuccess() {
    return {
      validatorKey: this.key,
      validatorName: this.name,
      result: VALIDATION_RESULT.SUCCESS,
    };
  }

  getError(errorObj, file, extraCopyPlaceholders = {}) {
    const relativeFilePath = file ? this.getRelativePath(file) : null;
    const copyPlaceholders = {
      file: relativeFilePath,
      ...extraCopyPlaceholders,
    };
    return {
      validatorKey: this.key,
      validatorName: this.name,
      error: errorObj.getCopy(copyPlaceholders),
      result: errorObj.severity || VALIDATION_RESULT.FATAL,
      key: `${this.key}.${errorObj.key}`,
      file: relativeFilePath,
    };
  }
}

module.exports = BaseValidator;
