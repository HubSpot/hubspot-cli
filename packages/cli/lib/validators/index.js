const ThemeConfigValidator = require('./marketplaceValidators/theme/ThemeConfigValidator');
const SectionValidator = require('./marketplaceValidators/theme/SectionValidator');
const TemplateValidator = require('./marketplaceValidators/theme/TemplateValidator');
const ModuleValidator = require('./marketplaceValidators/theme/ModuleValidator');
const DependencyValidator = require('./marketplaceValidators/theme/DependencyValidator');

const SpecificModuleValidator = require('./marketplaceValidators/module/SpecificModuleValidator');
const ModuleDependencyValidator = require('./marketplaceValidators/module/ModuleDependencyValidator');

const MARKETPLACE_VALIDATORS = {
  theme: [
    ThemeConfigValidator,
    SectionValidator,
    TemplateValidator,
    ModuleValidator,
    DependencyValidator,
  ],
  module: [SpecificModuleValidator, ModuleDependencyValidator],
};

module.exports = MARKETPLACE_VALIDATORS;
