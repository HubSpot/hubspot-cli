const ThemeValidator = require('./marketplaceValidators/theme/ThemeValidator');
const TemplateValidator = require('./marketplaceValidators/theme/TemplateValidator');
const ModuleValidator = require('./marketplaceValidators/theme/ModuleValidator');

const MARKETPLACE_VALIDATORS = {
  theme: [ThemeValidator, TemplateValidator, ModuleValidator],
};

module.exports = MARKETPLACE_VALIDATORS;
