import { Options, CommandModule, Argv } from 'yargs';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';

export type CommonArgs = {
  derivedAccountId: number;
  providedAccountId?: number;
  d: boolean;
  debug: boolean;
};

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

export type ProjectDevArgs = CommonArgs &
  ConfigArgs &
  EnvironmentArgs & {
    profile?: string;
    targetTestingAccount?: number | string;
    targetProjectAccount?: number | string;
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
