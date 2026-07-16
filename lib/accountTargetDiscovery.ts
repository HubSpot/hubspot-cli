import path from 'path';
import {
  getConfigAccountIfExists,
  getConfigDefaultAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { getHsSettingsFileIfExists } from '@hubspot/local-dev-lib/config/hsSettings';
import { ENVIRONMENT_VARIABLES } from '@hubspot/local-dev-lib/constants/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import {
  getAllHsProfiles,
  loadHsProfileFile,
} from '@hubspot/project-parsing-lib/profiles';
import { isTestAccountOrSandbox } from './accountTypes.js';
import { isDirectoryLinked } from './link/linkUtils.js';
import { lib } from '../lang/en.js';
import { ProjectConfig } from '../types/Projects.js';
import {
  DiscoverAccountTargetsOptions,
  DiscoverAccountTargetsResult,
  AccountTargetCandidate,
  AccountTargetCategory,
  AccountTargetSelectionSource,
  ACCOUNT_TARGET_CATEGORIES,
  ACCOUNT_TARGET_SELECTION_SOURCES,
} from '../types/AccountTargets.js';

function categorizeAccount(
  account: HubSpotConfigAccount
): AccountTargetCategory {
  if (isTestAccountOrSandbox(account)) {
    return ACCOUNT_TARGET_CATEGORIES.RECOMMENDED_TESTING;
  }
  if (!account.accountType) {
    return ACCOUNT_TARGET_CATEGORIES.UNKNOWN;
  }
  return ACCOUNT_TARGET_CATEGORIES.PRODUCTION_WITH_CARE;
}

function candidateFromAccount(
  account: HubSpotConfigAccount,
  source: AccountTargetSelectionSource,
  profileName?: string
): AccountTargetCandidate {
  return {
    accountId: account.accountId,
    accountName: account.name,
    accountType: account.accountType,
    environment: account.env || undefined,
    source,
    category: categorizeAccount(account),
    ...(profileName ? { profileName } : {}),
  };
}

function candidateFromAccountId(
  accountId: number,
  source: AccountTargetSelectionSource,
  profileName?: string
): AccountTargetCandidate {
  const account = getConfigAccountIfExists(accountId);
  if (account) {
    return candidateFromAccount(account, source, profileName);
  }
  return {
    accountId,
    source,
    category: ACCOUNT_TARGET_CATEGORIES.UNKNOWN,
    ...(profileName ? { profileName } : {}),
  };
}

function dedupeByAccountId(
  candidates: AccountTargetCandidate[]
): AccountTargetCandidate[] {
  const seen = new Set<number>();
  return candidates.filter(candidate => {
    if (seen.has(candidate.accountId)) {
      return false;
    }
    seen.add(candidate.accountId);
    return true;
  });
}

async function gatherProfileCandidates(
  projectDir: string,
  projectConfig: ProjectConfig
): Promise<AccountTargetCandidate[]> {
  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);
  const profileNames = await getAllHsProfiles(projectSourceDir);
  const candidates: AccountTargetCandidate[] = [];

  for (const name of profileNames) {
    let profile;
    try {
      profile = loadHsProfileFile(projectSourceDir, name);
    } catch {
      continue;
    }
    if (profile && profile.accountId) {
      candidates.push(
        candidateFromAccountId(
          profile.accountId,
          ACCOUNT_TARGET_SELECTION_SOURCES.PROFILE,
          name
        )
      );
    }
  }

  return candidates;
}

function resolveProfileRecommendation(
  profileCandidates: AccountTargetCandidate[],
  explicitProfileName?: string
): AccountTargetCandidate | undefined {
  if (explicitProfileName) {
    return profileCandidates.find(
      candidate => candidate.profileName === explicitProfileName
    );
  }
  if (profileCandidates.length === 1) {
    return profileCandidates[0];
  }
  return undefined;
}

type NonProfileInputs = {
  explicitCandidate?: AccountTargetCandidate;
  envCandidate?: AccountTargetCandidate;
  linkedCandidates: AccountTargetCandidate[];
  linkedDefaultAccountId?: number;
  defaultCandidate?: AccountTargetCandidate;
};

function resolveNonProfileRecommendation({
  explicitCandidate,
  envCandidate,
  linkedCandidates,
  linkedDefaultAccountId,
  defaultCandidate,
}: NonProfileInputs): AccountTargetCandidate | undefined {
  if (explicitCandidate) {
    return explicitCandidate;
  }
  if (envCandidate) {
    return envCandidate;
  }
  if (linkedCandidates.length > 0) {
    if (linkedDefaultAccountId !== undefined) {
      const linkedDefault = linkedCandidates.find(
        candidate => candidate.accountId === linkedDefaultAccountId
      );
      if (linkedDefault) {
        return linkedDefault;
      }
    }
    if (linkedCandidates.length === 1) {
      return linkedCandidates[0];
    }
    return undefined;
  }
  return defaultCandidate;
}

/**
 * Discovers the candidate target accounts for a command, plus the recommended
 * one to use when a single account is the obvious choice.
 *
 * Profiles take precedence: when the project defines profiles, the candidates
 * are the profile accounts only. Otherwise they are ranked explicit account,
 * then env config, then linked directory, then global default.
 *
 * Takes plain options (not yargs argv) and never prompts or exits, so both the
 * CLI and MCP can call it. `recommended` is omitted when no account is the
 * obvious choice (for example, several profiles). Throws when an explicit
 * account is provided but not found in the config.
 */
export async function discoverAccountTargets(
  options: DiscoverAccountTargetsOptions = {}
): Promise<DiscoverAccountTargetsResult> {
  const { explicitAccount, useEnv, profileName, projectDir, projectConfig } =
    options;

  if (projectDir && projectConfig) {
    const profileCandidates = await gatherProfileCandidates(
      projectDir,
      projectConfig
    );
    if (profileCandidates.length > 0) {
      return {
        candidates: dedupeByAccountId(profileCandidates),
        recommended: resolveProfileRecommendation(
          profileCandidates,
          profileName
        ),
      };
    }
  }

  const envConfigActive =
    Boolean(useEnv) ||
    process.env[ENVIRONMENT_VARIABLES.USE_ENVIRONMENT_HUBSPOT_CONFIG] ===
      'true';

  const ordered: AccountTargetCandidate[] = [];

  let explicitCandidate: AccountTargetCandidate | undefined;
  if (explicitAccount !== undefined && explicitAccount !== '') {
    const account = getConfigAccountIfExists(explicitAccount);
    if (!account) {
      throw new Error(
        lib.accountTargetDiscovery.errors.explicitAccountNotFound(
          explicitAccount
        )
      );
    }
    explicitCandidate = candidateFromAccount(
      account,
      ACCOUNT_TARGET_SELECTION_SOURCES.EXPLICIT_ACCOUNT
    );
    ordered.push(explicitCandidate);
  }

  let envCandidate: AccountTargetCandidate | undefined;
  if (envConfigActive) {
    const envAccount = getConfigDefaultAccountIfExists();
    if (envAccount) {
      envCandidate = candidateFromAccount(
        envAccount,
        ACCOUNT_TARGET_SELECTION_SOURCES.ENV_CONFIG
      );
      ordered.push(envCandidate);
    }
  }

  const settings = getHsSettingsFileIfExists();
  const directoryIsLinked = isDirectoryLinked(settings);
  const linkedCandidates: AccountTargetCandidate[] = [];
  if (directoryIsLinked) {
    for (const accountId of settings.accounts) {
      const candidate = candidateFromAccountId(
        accountId,
        ACCOUNT_TARGET_SELECTION_SOURCES.LINKED_DIRECTORY
      );
      linkedCandidates.push(candidate);
      ordered.push(candidate);
    }
  }

  let defaultCandidate: AccountTargetCandidate | undefined;
  if (!envConfigActive) {
    const defaultAccount = getConfigDefaultAccountIfExists();
    if (defaultAccount) {
      defaultCandidate = candidateFromAccount(
        defaultAccount,
        ACCOUNT_TARGET_SELECTION_SOURCES.GLOBAL_DEFAULT
      );
      ordered.push(defaultCandidate);
    }
  }

  return {
    candidates: dedupeByAccountId(ordered),
    recommended: resolveNonProfileRecommendation({
      explicitCandidate,
      envCandidate,
      linkedCandidates,
      linkedDefaultAccountId: directoryIsLinked
        ? settings.localDefaultAccount
        : undefined,
      defaultCandidate,
    }),
  };
}
