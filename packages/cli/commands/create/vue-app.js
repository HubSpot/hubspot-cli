const { createProject } = require('@hubspot/cli-lib/projects');

module.exports = {
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ options, dest, assetType }) =>
    createProject(dest, assetType, 'cms-vue-boilerplate', '', options),
};
