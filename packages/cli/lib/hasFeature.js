const {
  fetchEnabledFeatures,
} = require('@hubspot/local-dev-lib/api/localDevAuth');

const hasEnabledFeature = async (accountId, feature) => {
  const {
    data: { enabledFeatures },
  } = await fetchEnabledFeatures(accountId);

  return enabledFeatures[feature];
};

module.exports = {
  hasEnabledFeature,
};
