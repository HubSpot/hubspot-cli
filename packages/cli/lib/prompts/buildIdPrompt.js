const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'lib.prompts.buildIdPrompt';
const buildIdPrompt = (latestBuildId, deployedBuildId, projectName, validate) => {
  return promptUser({
    name: 'buildId',
    message: i18n(`${i18nKey}.enterBuildId`),
    default: () => {
      if (latestBuildId === deployedBuildId) {
        return;
      }
      return latestBuildId;
    },
    validate,
  });
};

module.exports = {
  buildIdPrompt,
};
