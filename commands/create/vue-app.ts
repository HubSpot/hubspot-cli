import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';

import { CreatableCmsAsset } from '../../types/Cms';

const vueAppAssetType: CreatableCmsAsset = {
  hidden: false,
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ commandArgs, dest, assetType }) => {
    await cloneGithubRepo('HubSpot/cms-vue-boilerplate', dest, {
      ...commandArgs,
      type: assetType,
    });
  },
};

export default vueAppAssetType;
