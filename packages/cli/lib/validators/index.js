const ModuleValidator = require('./marketplaceValidators/module/ModuleValidator');
const ModuleDependencyValidator = require('./marketplaceValidators/module/ModuleDependencyValidator');

const MARKETPLACE_VALIDATORS = {
  module: [ModuleValidator, ModuleDependencyValidator],
};

module.exports = MARKETPLACE_VALIDATORS;
