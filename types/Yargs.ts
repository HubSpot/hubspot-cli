import { Arguments } from 'yargs';

export type CommonOptions<T = object> = Arguments<
  T & {
    derivedAccountId: number;
    providedAccountId?: number;
    d: boolean;
    debug: boolean;
  }
>;
