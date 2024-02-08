const { cloneGitHubRepo } = require('@hubspot/cli-lib/github');

module.exports = {
  hidden: true,
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ options, dest, assetType }) =>
    cloneGitHubRepo(
      dest,
      assetType,
      'HubSpot/crm-card-weather-app',
      '',
      options
    ),
};
