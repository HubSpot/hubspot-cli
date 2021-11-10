const { promptUser } = require('./promptUtils');

const createSandboxPrompt = () => {
  return promptUser([
    {
      name: 'name',
      message: 'Enter a name to use for the sandbox: ',
      validate(val) {
        if (typeof val !== 'string') {
          return 'You entered an invalid name. Please try again.';
        }
        return true;
      },
      default: 'New sandbox',
    },
  ]);
};

module.exports = {
  createSandboxPrompt,
};
