const { promptUser } = require('./promptUtils');

const generateProjectPrompt = choices => {
  return promptUser([
    {
      name: 'component',
      message: 'which template would you like to choose?',
      type: 'list',
      choices,
    },
  ]);
};

module.exports = {
  generateProjectPrompt,
};
