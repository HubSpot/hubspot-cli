import { Options, CommandModule, Argv } from 'yargs';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import { ValueOf } from '@hubspot/local-dev-lib/types/Utils';
import { UsageTrackingMeta } from '../lib/usageTracking.js';

export type UsageTrackingMetaWithAccountId = UsageTrackingMeta & {
  accountId?: number;
};

export type AddUsageMetadata = (
  meta: Omit<UsageTrackingMetaWithAccountId, 'successful'>
) => void;

export type UsageTrackingArgs = {
  addUsageMetadata: AddUsageMetadata;
  exit: ExitFunction;
};

type AccountMiddlewareArgs = {
  derivedAccountId: number;
  userProvidedAccount?: string;
};

type DebugArgs = {
  d: boolean;
  debug: boolean;
};

export type CommonArgs = AccountMiddlewareArgs & DebugArgs & UsageTrackingArgs;

export type ConfigArgs = {
  c?: string;
  config?: string;
};

export type AccountArgs = {
  a?: string;
  account?: string;
};

export type EnvironmentArgs = {
  'use-env'?: string;
};

export type OverwriteArgs = Options & {
  o?: boolean;
  overwrite?: boolean;
};

export type StringArgType = Options & {
  type: 'string';
};

export type JSONOutputArgs = Options & {
  json?: boolean;
  formatOutputAsJson?: boolean;
};

export type ProjectDevArgs = CommonArgs &
  ConfigArgs &
  EnvironmentArgs & {
    profile?: string;
    testingAccount?: string | number;
    projectAccount?: string | number;
  };

export type TestingArgs = {
  qa?: boolean;
};

export type CmsPublishModeArgs = {
  'cms-publish-mode'?: CmsPublishMode;
  m?: CmsPublishMode;
};

export interface YargsCommandModule<T, U> extends CommandModule<T, U> {
  builder: (yargs: Argv) => Promise<Argv<U>>;
}

export type YargsCommandModuleBucket = YargsCommandModule<unknown, object>;

export type ExitCode = ValueOf<typeof EXIT_CODES>;
export type ExitFunction = (code: ExitCode) => Promise<never>;
