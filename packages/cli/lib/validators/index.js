const themeConfigValidator = require('./marketplaceValidators/theme/themeConfigValidator');
const templateLimitValidator = require('./marketplaceValidators/theme/templateLimitValidator');

const MARKETPLACE_VALIDATORS = {
  theme: [themeConfigValidator, templateLimitValidator],
};

module.exports = MARKETPLACE_VALIDATORS;
