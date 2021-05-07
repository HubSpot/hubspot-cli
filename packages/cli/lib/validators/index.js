const ThemeConfigValidator = require('./marketplaceValidators/theme/ThemeConfigValidator');
const TemplateLimitValidator = require('./marketplaceValidators/theme/TemplateLimitValidator');

const MARKETPLACE_VALIDATORS = {
  theme: [ThemeConfigValidator, TemplateLimitValidator],
};

module.exports = MARKETPLACE_VALIDATORS;
