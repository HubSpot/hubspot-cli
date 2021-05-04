async function applyValidators(validators, ...args) {
  return Promise.all(
    validators.map(async Validator => {
      const validationResult = await Validator.validate(...args);
      if (!validationResult.length) {
        // Return a success obj so we can log the success
        return [Validator.getSuccess()];
      }
      return validationResult;
    })
  ).then(errorsGroupedByValidatorType => errorsGroupedByValidatorType.flat());
}

module.exports = { applyValidators };
