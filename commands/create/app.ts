import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';
import { CreatableCmsAsset } from '../../types/Cms';

const AppAssetType: CreatableCmsAsset = {
  hidden: true,
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ commandArgs, dest, assetType }) => {
    cloneGithubRepo('HubSpot/crm-card-weather-app', dest, {
      type: assetType,
      ...commandArgs,
    });
  },
};

export default AppAssetType;
// TODO: Remove
module.exports = AppAssetType;
