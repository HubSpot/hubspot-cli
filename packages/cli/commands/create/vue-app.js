const { cloneGitHubRepo } = require('@hubspot/local-dev-lib/github');

module.exports = {
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ options, dest, assetType }) =>
    cloneGitHubRepo('HubSpot/cms-vue-boilerplate', dest, {
      type: assetType,
      ...options,
    }),
};
