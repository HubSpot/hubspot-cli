import {
  AccountType,
  Environment,
} from '@hubspot/local-dev-lib/types/Accounts';
import { ValueOf } from '@hubspot/local-dev-lib/types/Utils';
import { ProjectConfig } from './Projects.js';

export const ACCOUNT_TARGET_SELECTION_SOURCES = {
  EXPLICIT_ACCOUNT: 'explicit-account',
  ENV_CONFIG: 'env-config',
  PROFILE: 'profile',
  LINKED_DIRECTORY: 'linked-directory',
  GLOBAL_DEFAULT: 'global-default',
} as const;

export type AccountTargetSelectionSource = ValueOf<
  typeof ACCOUNT_TARGET_SELECTION_SOURCES
>;

export const ACCOUNT_TARGET_CATEGORIES = {
  RECOMMENDED_TESTING: 'recommended-testing',
  PRODUCTION_WITH_CARE: 'production-with-care',
  UNKNOWN: 'unknown',
} as const;

export type AccountTargetCategory = ValueOf<typeof ACCOUNT_TARGET_CATEGORIES>;

export type AccountTargetCandidate = {
  accountId: number;
  accountName?: string;
  accountType?: AccountType;
  environment?: Environment;
  source: AccountTargetSelectionSource;
  category: AccountTargetCategory;
  profileName?: string;
};

export type DiscoverAccountTargetsOptions = {
  explicitAccount?: string | number;
  useEnv?: boolean;
  profileName?: string;
  projectDir?: string | null;
  projectConfig?: ProjectConfig | null;
};

export type DiscoverAccountTargetsResult = {
  candidates: AccountTargetCandidate[];
  recommended?: AccountTargetCandidate;
};
