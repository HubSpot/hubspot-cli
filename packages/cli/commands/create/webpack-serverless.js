const { cloneGitHubRepo } = require('@hubspot/cli-lib/github');

module.exports = {
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ options, dest, assetType }) =>
    cloneGitHubRepo(
      dest,
      assetType,
      'HubSpot/cms-webpack-serverless-boilerplate',
      '',
      options
    ),
};
