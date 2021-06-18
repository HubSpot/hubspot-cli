const WARNING = 'WARNING';
const FATAL = 'FATAL';
const SUCCESS = 'SUCCESS';

const VALIDATION_RESULT = { WARNING, FATAL, SUCCESS };
const VALIDATOR_KEYS = {
  dependency: 'dependency',
  module: 'module',
  template: 'template',
  themeConfig: 'themeConfig',
};

module.exports = { VALIDATOR_KEYS, VALIDATION_RESULT };
