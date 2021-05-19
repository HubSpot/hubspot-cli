const ValidatorStore = require('./ValidatorStore');

async function applyValidators(validators, ...args) {
  // Clear global store
  ValidatorStore.clear();

  return Promise.all(
    validators.map(async Validator => {
      const validationResult = await Validator.validate(...args);
      if (!validationResult.length) {
        // Return a success obj so we can log the successes
        return [Validator.getSuccess()];
      }
      return validationResult;
    })
  ).then(errorsGroupedByValidatorType => errorsGroupedByValidatorType.flat());
}

module.exports = { applyValidators };
