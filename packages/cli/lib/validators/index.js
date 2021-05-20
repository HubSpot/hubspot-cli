const ThemeValidator = require('./marketplaceValidators/theme/ThemeValidator');
const TemplateCountValidator = require('./marketplaceValidators/theme/TemplateCountValidator');
const ModuleValidator = require('./marketplaceValidators/theme/ModuleValidator');

const MARKETPLACE_VALIDATORS = {
  theme: [ThemeValidator, TemplateCountValidator, ModuleValidator],
};

module.exports = MARKETPLACE_VALIDATORS;
