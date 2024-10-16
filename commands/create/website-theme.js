const { cloneGithubRepo } = require('@hubspot/local-dev-lib/github');
const { getIsInProject } = require('../../lib/projects');

const PROJECT_BOILERPLATE_BRANCH = 'cms-boilerplate-developer-projects';

module.exports = {
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ dest, assetType, options }) => {
    const isInProject = await getIsInProject(dest);

    if (isInProject) {
      options.branch = PROJECT_BOILERPLATE_BRANCH;
    }
    cloneGithubRepo('HubSpot/cms-theme-boilerplate', dest, {
      type: assetType,
      sourceDir: 'src',
      ...options,
    });
  },
};
