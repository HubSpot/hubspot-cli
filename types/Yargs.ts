import { Options } from 'yargs';

export interface CommonArgs extends Options {
  derivedAccountId: number;
  providedAccountId?: number;
  d: boolean;
  debug: boolean;
}
