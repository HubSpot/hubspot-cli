import request, { Options } from 'request-promise-native';
import { Mode } from './lib/constants';
import Moment from 'moment';

export type Environment = 'qa' | 'prod';

// TS-TODO: Is this supposed to have both oauth and oauth2?
export type AuthType = 'oauth' | 'personalaccesskey' | 'oauth2';
export type TokenInfo = {
  accessToken?: string;
  expiresAt?: string | moment.Moment;
  refreshToken?: string;
};

// TS-TODO: Seems to be a ton of duplication in our configs.  Should we take a pass at
// consolidating and auditing? Would we have to worry about Back compat?
export type AuthInfo = {
  tokenInfo?: TokenInfo;
  clientId?: string;
  clientSecret?: string;
  scopes?: Array<string>;
};

// TS-TODO: enumerate Scope
export type Scope = string;

export type Account = {
  name?: string;
  portalId?: number | string;
  // TS-TODO: Both of these are referenced, which is correct?
  env?: Environment;
  environment?: Environment;
  authType?: AuthType;
  auth?: AuthInfo;
  personalAccessKey?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: Array<Scope>;
  // TS-TODO: This is referenced at the top level of this config, as well as under `auth`.
  // Is that correct?
  tokenInfo?: TokenInfo;
  defaultMode?: Mode;
  apiKey?: string;
};

export type AccountConfig = {
  defaultPortal?: string | number;
  portals?: Array<Account>;
  defaultMode?: Mode;
  httpTimeout?: number;
  // TS-TODO: env is referenced on both an individual portal config, as well as
  // in the root config, is this a bug?
  env?: Environment;
  // TS-TODO: These are both referenced.  One is a typo.  Which one?
  allowsUsageTracking?: boolean;
  allowUsageTracking?: boolean;
};

export type Query =
  | {
      [key: string]: any;
    }
  | undefined;
export type RequestOptions = Options & { qs?: Query };

export enum LOG_LEVEL {
  NONE = 0,
  DEBUG = 1,
  LOG = 2,
  WARN = 4,
  ERROR = 8,
}

export interface ErrorContext {
  accountId: number;
}

export type StatusCodeError = {
  statusCode: number;
  message: string;
  response: request.FullResponse;
  name: 'StatusCodeError';
};

export type FileManagerFile = {
  extension: string;
  name: string;
  url: string;
  archived: boolean;
  hidden: boolean;
};

export type FileManagerFolder = {
  id: string;
  name?: string;
};
