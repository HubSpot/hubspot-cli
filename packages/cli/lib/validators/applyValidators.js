async function applyValidators(validators, absoluteThemePath, ...args) {
  return Promise.all(
    validators.map(async Validator => {
      Validator.setThemePath(absoluteThemePath);
      const validationResult = await Validator.validate(...args);
      Validator.clearThemePath();

      if (!validationResult.length) {
        // Return a success obj so we can log the successes
        return [Validator.getSuccess()];
      }
      return validationResult;
    })
  ).then(errorsGroupedByValidatorType => errorsGroupedByValidatorType.flat());
}

module.exports = { applyValidators };
