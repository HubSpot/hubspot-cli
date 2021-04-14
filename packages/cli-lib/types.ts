import request, { Options } from 'request-promise-native';

export type Environment = 'qa' | 'prod';
export type AuthType = 'oauth' | 'personalaccesskey';
export type AuthInfo = {
  tokenInfo: {
    accessToken: string;
    expiresAt: string;
  };
};

export type PortalConfig = {
  name: string;
  portalId: number;
  env?: Environment;
  authType: AuthType;
  auth: AuthInfo;
  personalAccessKey?: string;
};

export type AccountConfig = {
  defaultPortal?: string;
  portals: Array<PortalConfig>;
};

export type Query =
  | {
      [key: string]: any;
    }
  | undefined;
export type RequestOptions = Options & Query;

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
