const { cloneGitHubRepo } = require('@hubspot/cli-lib/github');
const { GITHUB_RELEASE_TYPES } = require('@hubspot/cli-lib/lib/constants');
const { getIsInProject } = require('../../lib/projects');

const PROJECT_BOILERPLATE_REF = 'cms-boilerplate-developer-projects';

module.exports = {
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ dest, assetType, options }) => {
    const isInProject = await getIsInProject(dest);

    if (isInProject) {
      options.ref = PROJECT_BOILERPLATE_REF;
      // releaseType has to be 'REPOSITORY' to download a specific branch
      options.releaseType = GITHUB_RELEASE_TYPES.REPOSITORY;
    }
    cloneGitHubRepo(
      dest,
      assetType,
      'HubSpot/cms-theme-boilerplate',
      'src',
      options
    );
  },
};
