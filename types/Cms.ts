// TODO: Add real type
export type CreateArgs = object;

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
