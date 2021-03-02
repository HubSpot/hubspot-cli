async function applyValidators(validators, ...args) {
  return Promise.all(
    validators.map(validator => validator.validate(...args))
  ).then(errorsGroupedByValidatorType => errorsGroupedByValidatorType.flat());
}

module.exports = { applyValidators };
