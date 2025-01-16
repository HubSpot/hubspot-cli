import { Options } from 'yargs';

export interface CommonOptions extends Options {
  derivedAccountId: number;
  providedAccountId?: number;
  d: boolean;
  debug: boolean;
}
