import { Options, CommandModule, Argv, ArgumentsCamelCase } from 'yargs';

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

export type MigrateAppOptions = CommonArgs &
  AccountArgs &
  EnvironmentArgs &
  ConfigArgs & {
    name: string;
    dest: string;
    appId: number;
    platformVersion: string;
  };

export type CloneAppArgs = ConfigArgs &
  EnvironmentArgs &
  AccountArgs &
  CommonArgs & {
    dest: string;
    appId: number;
  };

// This is a workaround to make the builder method required for the CommandModule
export type YargsCommandModule<T, U> = Omit<CommandModule<T, U>, 'builder'> & {
  builder: (yargs: Argv) => Promise<Argv<U>>;
};

export type YargsCommandModuleBucket<T, U> = Omit<
  CommandModule<T, U>,
  'builder' | 'handler'
> & {
  builder: (yargs: Argv) => Promise<Argv>;
  handler?: (args: ArgumentsCamelCase<U>) => void | Promise<void>;
};
