const { promptUser } = require('./promptUtils');

const folderOverwritePrompt = folderName => {
  return promptUser({
    type: 'confirm',
    name: 'overwrite',
    message: `The folder with name '${folderName}' already exists. Overwrite?`,
    default: false,
  });
};

module.exports = {
  folderOverwritePrompt,
};
