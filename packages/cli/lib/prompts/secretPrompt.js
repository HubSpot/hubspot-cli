const { promptUser } = require('./promptUtils');

const SECRET_VALUE_PROMPT = {
  name: 'secretValue',
  type: 'password',
  mask: '*',
  message: 'Enter a value for your secret',
  validate(val) {
    if (typeof val !== 'string') {
      return 'You entered an invalid value. Please try again.';
    }
    return true;
  },
};

function secretValuePrompt() {
  return promptUser([SECRET_VALUE_PROMPT]);
}

module.exports = {
  secretValuePrompt,
};
