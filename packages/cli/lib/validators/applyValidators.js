const { VALIDATION_RESULT } = require('./constants');

async function applyValidators(validators, ...args) {
  return Promise.all(
    validators.map(async validator => {
      const validationResult = await validator.validate(...args);
      return !validationResult.length
        ? [{ validator: validator.name, result: VALIDATION_RESULT.SUCCESS }]
        : validationResult;
    })
  ).then(errorsGroupedByValidatorType => errorsGroupedByValidatorType.flat());
}

module.exports = { applyValidators };
