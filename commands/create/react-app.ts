import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';
import { CreatableCmsAsset } from '../../types/Cms';

const ReactAppAssetType: CreatableCmsAsset = {
  hidden: false,
  dest: ({ name, assetType }) => name || assetType,
  execute: async ({ commandArgs, dest, assetType }) => {
    cloneGithubRepo('HubSpot/cms-react-boilerplate', dest, {
      type: assetType,
      ...commandArgs,
    });
  },
};

export default ReactAppAssetType;
// TODO: Remove
module.exports = ReactAppAssetType;
