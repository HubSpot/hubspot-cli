import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';
import { CreatableCmsAsset } from '../../types/Cms.js';

const webpackServerlessAssetType: CreatableCmsAsset = {
  hidden: false,
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ commandArgs, dest, assetType }) => {
    await cloneGithubRepo('HubSpot/cms-webpack-serverless-boilerplate', dest, {
      ...commandArgs,
      type: assetType,
    });
  },
};

export default webpackServerlessAssetType;
