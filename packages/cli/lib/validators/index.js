const ThemeConfigValidator = require('./marketplaceValidators/theme/ThemeConfigValidator');
const SectionValidator = require('./marketplaceValidators/theme/SectionValidator');
const TemplateValidator = require('./marketplaceValidators/theme/TemplateValidator');
const ModuleValidator = require('./marketplaceValidators/theme/ModuleValidator');
const DependencyValidator = require('./marketplaceValidators/theme/DependencyValidator');

const MARKETPLACE_VALIDATORS = {
  theme: [
    ThemeConfigValidator,
    SectionValidator,
    TemplateValidator,
    ModuleValidator,
    DependencyValidator,
  ],
};

module.exports = MARKETPLACE_VALIDATORS;
