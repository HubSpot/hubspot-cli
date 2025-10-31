import { CommonArgs, ConfigArgs } from './Yargs.js';

export const TEMPLATE_TYPES = [
  'page-template',
  'email-template',
  'partial',
  'global-partial',
  'blog-listing-template',
  'blog-post-template',
  'search-template',
  'section',
] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export const HTTP_METHODS = ['DELETE', 'GET', 'PATCH', 'POST', 'PUT'] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export const CONTENT_TYPES = [
  'ANY',
  'LANDING_PAGE',
  'SITE_PAGE',
  'BLOG_POST',
  'BLOG_LISTING',
  'EMAIL',
  'KNOWLEDGE_BASE',
  'QUOTE_TEMPLATE',
  'CUSTOMER_PORTAL',
  'WEB_INTERACTIVE',
  'SUBSCRIPTION',
  'MEMBERSHIP',
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export type CreateArgs = CommonArgs &
  ConfigArgs & {
    branch?: string;
    type?: string;
    dest?: string;
    name?: string;
    internal?: boolean;
    templateType?: TemplateType;
    moduleLabel?: string;
    reactType?: boolean;
    contentTypes?: string;
    global?: boolean;
    availableForNewContent?: boolean;
    functionsFolder?: string;
    filename?: string;
    endpointMethod?: HttpMethod;
    endpointPath?: string;
  };

export type CmsAssetOperationArgs = {
  assetType: string;
  name?: string;
  dest?: string;
  getInternalVersion?: boolean;
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
