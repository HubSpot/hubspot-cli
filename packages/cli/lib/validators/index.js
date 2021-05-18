const ThemeLabelValidator = require('./marketplaceValidators/theme/ThemeLabelValidator');
const TemplateCountValidator = require('./marketplaceValidators/theme/TemplateCountValidator');
const ModuleCountValidator = require('./marketplaceValidators/theme/ModuleCountValidator');
const ModuleLabelValidator = require('./marketplaceValidators/theme/ModuleLabelValidator');

const MARKETPLACE_VALIDATORS = {
  theme: [
    ThemeLabelValidator,
    TemplateCountValidator,
    ModuleCountValidator,
    ModuleLabelValidator,
  ],
};

module.exports = MARKETPLACE_VALIDATORS;
