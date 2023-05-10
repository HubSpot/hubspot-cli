const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.prompts.buildIdPrompt';

const buildIdPrompt = (latestBuildId, deployedBuildId, projectName) => {
  return promptUser({
    name: 'buildId',
    message: i18n(`${i18nKey}.enterBuildId`),
    default: () => {
      if (latestBuildId === deployedBuildId) {
        return;
      }
      return latestBuildId;
    },
    validate: val => {
      if (Number(val) > latestBuildId) {
        return i18n(`${i18nKey}.errors.buildIdDoesNotExist`, {
          buildId: val,
          projectName,
        });
      }
      if (Number(val) === deployedBuildId) {
        return i18n(`${i18nKey}.errors.buildAlreadyDeployed`, {
          buildId: val,
        });
      }
      return true;
    },
  });
};

module.exports = {
  buildIdPrompt,
};
