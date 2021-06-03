const { createProject } = require('@hubspot/cli-lib/projects');

module.exports = {
  dest: ({ name, assetType }) => name || assetType,
  execute: ({ dest, assetType, options }) => {
    createProject(dest, assetType, 'cms-theme-boilerplate', 'src', options);
  },
};
