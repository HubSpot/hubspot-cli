const WARNING = 'WARNING';
const FATAL = 'FATAL';
const SUCCESS = 'SUCCESS';

const VALIDATION_RESULT = { WARNING, FATAL, SUCCESS };
const VALIDATOR_KEYS = {
  themeDependency: 'themeDependency',
  themeModule: 'themeModule',
  section: 'section',
  template: 'template',
  themeConfig: 'themeConfig',
  module: 'module',
  moduleDependency: 'moduleDependency',
};

module.exports = { VALIDATOR_KEYS, VALIDATION_RESULT };
