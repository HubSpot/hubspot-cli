const ThemeConfigValidator = require('./marketplaceValidators/theme/ThemeConfigValidator');
const SectionValidator = require('./marketplaceValidators/theme/SectionValidator');
const TemplateValidator = require('./marketplaceValidators/theme/TemplateValidator');
const ThemeModuleValidator = require('./marketplaceValidators/theme/ThemeModuleValidator');
const ThemeDependencyValidator = require('./marketplaceValidators/theme/ThemeDependencyValidator');

const ModuleValidator = require('./marketplaceValidators/module/ModuleValidator');
const ModuleDependencyValidator = require('./marketplaceValidators/module/ModuleDependencyValidator');

const MARKETPLACE_VALIDATORS = {
  theme: [
    ThemeConfigValidator,
    SectionValidator,
    TemplateValidator,
    ThemeModuleValidator,
    ThemeDependencyValidator,
  ],
  module: [ModuleValidator, ModuleDependencyValidator],
};

module.exports = MARKETPLACE_VALIDATORS;
