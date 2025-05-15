import { CommonArgs, ConfigArgs } from './Yargs';

export type CreateArgs = CommonArgs &
  ConfigArgs & {
    branch?: string;
    type: string;
    dest: string;
    name: string;
    internal?: boolean;
  };

export type CmsAssetOperationArgs = {
  assetType: string;
  name: string;
  dest: string;
  getInternalVersion: boolean;
  commandArgs: CreateArgs;
};

export type CreatableCmsAsset = {
  hidden: boolean;
  dest: (args: CmsAssetOperationArgs) => string;
  validate?: (args: CmsAssetOperationArgs) => boolean;
  execute: (args: CmsAssetOperationArgs) => Promise<void>;
};

export type ApiSampleChoice = {
  name: string;
  description: string;
  id: string;
  languages: string[];
};

export type ApiSampleConfig = {
  samples: ApiSampleChoice[];
};
