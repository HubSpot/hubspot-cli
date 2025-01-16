import { Options } from 'yargs';

export type CommonOptions = {
  derivedAccountId: number;
};

export type ConfigOptions = {
  config?: string;
};

export type StringOptionsType = Options & {
  type: 'string';
};

export type BooleanOptionsType = Options & {
  type: 'boolean';
};
