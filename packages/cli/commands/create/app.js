const { cloneGitHubRepo } = require('@hubspot/local-dev-lib/github');

module.exports = {
  hidden: true,
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ options, dest, assetType }) =>
    cloneGitHubRepo('HubSpot/crm-card-weather-app', dest, {
      type: assetType,
      ...options,
    }),
};
