const { logger } = require('@hubspot/local-dev-lib/logger');
// const { fetchEnabledFeaturesForAccount } = require('@hubspot/local-dev-lib/api/localDevAuth')
const { i18n } = require('./lang');

const fetchEnabledFeaturesForAccount = () => ({ enabledFeatures: [] });

function logGatingErrorAndExit() {}

function checkRequiredGates(accountId, gates, featureName, options) {
  const { enabledFeatures } = fetchEnabledFeaturesForAccount();

  gates.forEach(gate => {
    if (!enabledFeatures.includes(gate)) {
      logGatingErrorAndExit();
    }
  });
}

module.exports = { checkRequiredGates };
