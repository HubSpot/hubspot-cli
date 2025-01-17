import { Options } from 'yargs';

export type CommonArgs = {
  derivedAccountId: number;
  providedAccountId?: number;
  d: boolean;
  debug: boolean;
};

export type ConfigOptions = {
  c?: string;
  config?: string;
};

export type StringOptionType = Options & {
  type: 'string';
};
