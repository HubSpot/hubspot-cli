const { cloneGithubRepo } = require('@hubspot/local-dev-lib/github');

module.exports = {
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ options, dest, assetType }) =>
    cloneGithubRepo('HubSpot/cms-react-boilerplate', dest, {
      type: assetType,
      ...options,
    }),
};
