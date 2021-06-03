const { createProject } = require('@hubspot/cli-lib/projects');

module.exports = {
  hidden: true,
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ options, dest, assetType }) =>
    createProject(dest, assetType, 'crm-card-weather-app', '', options),
};
