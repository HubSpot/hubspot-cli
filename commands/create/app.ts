import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';
import { CreatableCmsAsset } from '../../types/Cms.js';

const appAssetType: CreatableCmsAsset = {
  hidden: true,
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ commandArgs, dest, assetType }) => {
    await cloneGithubRepo('HubSpot/crm-card-weather-app', dest, {
      ...commandArgs,
      type: assetType,
    });
  },
};

export default appAssetType;
