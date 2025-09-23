import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';
import { getIsInProject } from '../../lib/projects/config.js';
import { CreatableCmsAsset } from '../../types/Cms.js';

const PROJECT_BOILERPLATE_BRANCH = 'cms-boilerplate-developer-projects';

const websiteThemeAssetType: CreatableCmsAsset = {
  hidden: false,
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ dest, assetType, commandArgs }) => {
    const isInProject = await getIsInProject(dest);

    if (isInProject) {
      commandArgs.branch = PROJECT_BOILERPLATE_BRANCH;
    }

    await cloneGithubRepo('HubSpot/cms-theme-boilerplate', dest, {
      ...commandArgs,
      type: assetType,
      sourceDir: 'src',
    });
  },
};

export default websiteThemeAssetType;
