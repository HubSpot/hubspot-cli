import { Options } from 'yargs';

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

export type ProjectDevArgs = CommonArgs & ConfigArgs & EnvironmentArgs;

export type TestingArgs = {
  qa?: boolean;
};
