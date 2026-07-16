import {
  getConfigAccountIfExists,
  getConfigDefaultAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { getHsSettingsFileIfExists } from '@hubspot/local-dev-lib/config/hsSettings';
import {
  HUBSPOT_ACCOUNT_TYPES,
  ENVIRONMENT_VARIABLES,
} from '@hubspot/local-dev-lib/constants/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import {
  getAllHsProfiles,
  loadHsProfileFile,
} from '@hubspot/project-parsing-lib/profiles';
import { discoverAccountTargets } from '../accountTargetDiscovery.js';
import {
  ACCOUNT_TARGET_CATEGORIES,
  ACCOUNT_TARGET_SELECTION_SOURCES,
} from '../../types/AccountTargets.js';
import { ProjectConfig } from '../../types/Projects.js';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/config/hsSettings');
vi.mock('@hubspot/project-parsing-lib/profiles');

const mockedGetConfigAccountIfExists = vi.mocked(getConfigAccountIfExists);
const mockedGetConfigDefaultAccountIfExists = vi.mocked(
  getConfigDefaultAccountIfExists
);
const mockedGetHsSettingsFileIfExists = vi.mocked(getHsSettingsFileIfExists);
const mockedGetAllHsProfiles = vi.mocked(getAllHsProfiles);
const mockedLoadHsProfileFile = vi.mocked(loadHsProfileFile);

const PROJECT_DIR = '/project';
const PROJECT_CONFIG: ProjectConfig = {
  name: 'my-project',
  srcDir: 'src',
  platformVersion: '2025.2',
};

function makeAccount(
  accountId: number,
  overrides: Partial<HubSpotConfigAccount> = {}
): HubSpotConfigAccount {
  return {
    accountId,
    name: `account-${accountId}`,
    env: 'prod',
    authType: 'personalaccesskey',
    ...overrides,
  } as HubSpotConfigAccount;
}

const SANDBOX = makeAccount(111, {
  accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
});
const DEV_TEST = makeAccount(222, {
  accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
});
const STANDARD = makeAccount(333, {
  accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
});
const APP_DEVELOPER = makeAccount(444, {
  accountType: HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER,
});
const NO_TYPE = makeAccount(555, { accountType: undefined });

function setConfigAccounts(accounts: HubSpotConfigAccount[]): void {
  const byId = new Map(accounts.map(account => [account.accountId, account]));
  mockedGetConfigAccountIfExists.mockImplementation(identifier =>
    byId.get(Number(identifier))
  );
}

function setProfiles(profilesByName: Record<string, number>): void {
  mockedGetAllHsProfiles.mockResolvedValue(Object.keys(profilesByName));
  mockedLoadHsProfileFile.mockImplementation((_dir, profileName) => ({
    accountId: profilesByName[profileName as string],
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetConfigAccountIfExists.mockReturnValue(undefined);
  mockedGetConfigDefaultAccountIfExists.mockReturnValue(undefined);
  mockedGetHsSettingsFileIfExists.mockReturnValue(null);
  mockedGetAllHsProfiles.mockResolvedValue([]);
  delete process.env[ENVIRONMENT_VARIABLES.USE_ENVIRONMENT_HUBSPOT_CONFIG];
});

afterEach(() => {
  delete process.env[ENVIRONMENT_VARIABLES.USE_ENVIRONMENT_HUBSPOT_CONFIG];
});

describe('lib/accountTargetDiscovery', () => {
  describe('profiles take precedence and scope candidates', () => {
    it('recommends the sole profile and offers only profile accounts', async () => {
      setConfigAccounts([SANDBOX, STANDARD]);
      setProfiles({ prod: 111 });
      mockedGetHsSettingsFileIfExists.mockReturnValue({
        accounts: [333],
        localDefaultAccount: 333,
      });
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(STANDARD);

      const { recommended, candidates } = await discoverAccountTargets({
        projectDir: PROJECT_DIR,
        projectConfig: PROJECT_CONFIG,
      });

      expect(recommended?.source).toBe(
        ACCOUNT_TARGET_SELECTION_SOURCES.PROFILE
      );
      expect(recommended?.accountId).toBe(111);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].source).toBe(
        ACCOUNT_TARGET_SELECTION_SOURCES.PROFILE
      );
    });

    it('recommends the explicitly named profile when multiple exist', async () => {
      setConfigAccounts([SANDBOX, STANDARD]);
      setProfiles({ qa: 111, prod: 333 });

      const { recommended } = await discoverAccountTargets({
        profileName: 'prod',
        projectDir: PROJECT_DIR,
        projectConfig: PROJECT_CONFIG,
      });

      expect(recommended?.profileName).toBe('prod');
      expect(recommended?.accountId).toBe(333);
    });

    it('requires selection (no recommendation) when multiple profiles exist', async () => {
      setConfigAccounts([SANDBOX, STANDARD]);
      setProfiles({ qa: 111, prod: 333 });

      const { recommended, candidates } = await discoverAccountTargets({
        projectDir: PROJECT_DIR,
        projectConfig: PROJECT_CONFIG,
      });

      expect(recommended).toBeUndefined();
      expect(
        candidates.filter(
          c => c.source === ACCOUNT_TARGET_SELECTION_SOURCES.PROFILE
        )
      ).toHaveLength(2);
    });

    it('returns no recommendation and no other sources when a named profile does not match', async () => {
      setConfigAccounts([SANDBOX, STANDARD]);
      setProfiles({ qa: 111 });
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(STANDARD);

      const { recommended, candidates } = await discoverAccountTargets({
        profileName: 'does-not-exist',
        projectDir: PROJECT_DIR,
        projectConfig: PROJECT_CONFIG,
      });

      expect(recommended).toBeUndefined();
      expect(
        candidates.every(
          c => c.source === ACCOUNT_TARGET_SELECTION_SOURCES.PROFILE
        )
      ).toBe(true);
    });

    it('ignores --account and --use-env when the project has profiles', async () => {
      setConfigAccounts([SANDBOX]);
      setProfiles({ prod: 111 });
      mockedGetHsSettingsFileIfExists.mockReturnValue({
        accounts: [333],
        localDefaultAccount: 333,
      });
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(STANDARD);

      // An unresolvable explicit account would normally throw, but profiles
      // short-circuit before it is ever validated.
      const { recommended, candidates } = await discoverAccountTargets({
        explicitAccount: 999,
        useEnv: true,
        projectDir: PROJECT_DIR,
        projectConfig: PROJECT_CONFIG,
      });

      expect(recommended?.source).toBe(
        ACCOUNT_TARGET_SELECTION_SOURCES.PROFILE
      );
      expect(recommended?.accountId).toBe(111);
      expect(candidates).toHaveLength(1);
    });
  });

  describe('precedence without profiles', () => {
    it('prefers an explicit account over env config', async () => {
      setConfigAccounts([STANDARD]);
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(SANDBOX);

      const { recommended, candidates } = await discoverAccountTargets({
        explicitAccount: 333,
        useEnv: true,
      });

      expect(recommended?.source).toBe(
        ACCOUNT_TARGET_SELECTION_SOURCES.EXPLICIT_ACCOUNT
      );
      expect(recommended?.accountId).toBe(333);
      expect(candidates.map(c => c.accountId)).toEqual([333, 111]);
    });

    it('prefers env config over a linked directory account', async () => {
      setConfigAccounts([SANDBOX]);
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(NO_TYPE);
      mockedGetHsSettingsFileIfExists.mockReturnValue({
        accounts: [111],
        localDefaultAccount: 111,
      });

      const { recommended } = await discoverAccountTargets({ useEnv: true });

      expect(recommended?.source).toBe(
        ACCOUNT_TARGET_SELECTION_SOURCES.ENV_CONFIG
      );
      expect(recommended?.accountId).toBe(555);
    });

    it('prefers a linked directory account over the global default', async () => {
      setConfigAccounts([SANDBOX, STANDARD]);
      mockedGetHsSettingsFileIfExists.mockReturnValue({
        accounts: [111],
        localDefaultAccount: 111,
      });
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(STANDARD);

      const { recommended } = await discoverAccountTargets();

      expect(recommended?.source).toBe(
        ACCOUNT_TARGET_SELECTION_SOURCES.LINKED_DIRECTORY
      );
      expect(recommended?.accountId).toBe(111);
    });

    it('falls back to the global default and flags its low-confidence source', async () => {
      setConfigAccounts([STANDARD]);
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(STANDARD);

      const { recommended } = await discoverAccountTargets();

      expect(recommended?.source).toBe(
        ACCOUNT_TARGET_SELECTION_SOURCES.GLOBAL_DEFAULT
      );
      expect(recommended?.accountId).toBe(333);
    });
  });

  describe('candidate generation', () => {
    it('gathers non-profile candidates from every source and dedupes by account id', async () => {
      setConfigAccounts([STANDARD, NO_TYPE]);
      mockedGetHsSettingsFileIfExists.mockReturnValue({
        accounts: [555],
        localDefaultAccount: undefined,
      });
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(STANDARD);

      const { candidates } = await discoverAccountTargets({
        explicitAccount: 333,
      });

      expect(candidates.map(c => c.accountId)).toEqual([333, 555]);
      expect(candidates.map(c => c.source)).toEqual([
        ACCOUNT_TARGET_SELECTION_SOURCES.EXPLICIT_ACCOUNT,
        ACCOUNT_TARGET_SELECTION_SOURCES.LINKED_DIRECTORY,
      ]);
    });

    it('marks a profile whose account is not in config as unknown', async () => {
      setConfigAccounts([]);
      setProfiles({ qa: 111 });

      const { candidates } = await discoverAccountTargets({
        projectDir: PROJECT_DIR,
        projectConfig: PROJECT_CONFIG,
      });

      expect(candidates).toHaveLength(1);
      expect(candidates[0].category).toBe(ACCOUNT_TARGET_CATEGORIES.UNKNOWN);
      expect(candidates[0].accountName).toBeUndefined();
    });

    it('surfaces env-derived accounts from the ambient environment variable', async () => {
      process.env[ENVIRONMENT_VARIABLES.USE_ENVIRONMENT_HUBSPOT_CONFIG] =
        'true';
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(NO_TYPE);

      const { recommended } = await discoverAccountTargets();

      expect(recommended?.source).toBe(
        ACCOUNT_TARGET_SELECTION_SOURCES.ENV_CONFIG
      );
      expect(recommended?.category).toBe(ACCOUNT_TARGET_CATEGORIES.UNKNOWN);
    });
  });

  describe('account target categories', () => {
    it.each([
      [SANDBOX, ACCOUNT_TARGET_CATEGORIES.RECOMMENDED_TESTING],
      [DEV_TEST, ACCOUNT_TARGET_CATEGORIES.RECOMMENDED_TESTING],
      [STANDARD, ACCOUNT_TARGET_CATEGORIES.PRODUCTION_WITH_CARE],
      [APP_DEVELOPER, ACCOUNT_TARGET_CATEGORIES.PRODUCTION_WITH_CARE],
      [NO_TYPE, ACCOUNT_TARGET_CATEGORIES.UNKNOWN],
    ])('categorizes %o as %s', async (account, expectedCategory) => {
      setConfigAccounts([account]);

      const { recommended } = await discoverAccountTargets({
        explicitAccount: account.accountId,
      });

      expect(recommended?.category).toBe(expectedCategory);
    });
  });

  describe('errors', () => {
    it('throws when an explicit account is not in config', async () => {
      setConfigAccounts([]);

      await expect(
        discoverAccountTargets({ explicitAccount: 999 })
      ).rejects.toThrow(/999/);
    });
  });
});
