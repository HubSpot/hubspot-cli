import { ArgumentsCamelCase } from 'yargs';

export type CommonArguments<T = object> = ArgumentsCamelCase<
  T & {
    derivedAccountId: number;
    providedAccountId?: number;
    d: boolean;
    debug: boolean;
  }
>;
