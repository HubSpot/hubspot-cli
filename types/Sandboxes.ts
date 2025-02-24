import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';

export type SandboxSyncTask = {
  type: string;
};

export type SandboxAccountType =
  | typeof HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX
  | typeof HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX;
