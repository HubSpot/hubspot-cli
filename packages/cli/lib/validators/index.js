const ThemeLabelValidator = require('./marketplaceValidators/theme/ThemeLabelValidator');
const TemplateCountValidator = require('./marketplaceValidators/theme/TemplateCountValidator');
const ModuleValidator = require('./marketplaceValidators/theme/ModuleValidator');

const MARKETPLACE_VALIDATORS = {
  theme: [ThemeLabelValidator, TemplateCountValidator, ModuleValidator],
};

module.exports = MARKETPLACE_VALIDATORS;
