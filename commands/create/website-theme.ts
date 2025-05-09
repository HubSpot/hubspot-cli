import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';
import { getIsInProject } from '../../lib/projects/config';
import { CreatableCmsAsset } from '../../types/Cms';
const PROJECT_BOILERPLATE_BRANCH = 'cms-boilerplate-developer-projects';

const websiteThemeAssetType: CreatableCmsAsset = {
  hidden: false,
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ dest, assetType, commandArgs }) => {
    const isInProject = await getIsInProject(dest);

    if (isInProject) {
      commandArgs.branch = PROJECT_BOILERPLATE_BRANCH;
    }
    cloneGithubRepo('HubSpot/cms-theme-boilerplate', dest, {
      type: assetType,
      sourceDir: 'src',
      ...commandArgs,
    });
  },
};

export default websiteThemeAssetType;
