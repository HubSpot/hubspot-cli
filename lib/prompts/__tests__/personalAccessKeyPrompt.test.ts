import open from 'open';
import { deleteConfigFileIfEmpty } from '@hubspot/local-dev-lib/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import {
  OAUTH_SCOPES,
  DEFAULT_OAUTH_SCOPES,
} from '@hubspot/local-dev-lib/constants/auth';
import {
  OAUTH_FLOW,
  legacyPersonalAccessKeyPrompt,
  personalAccessKeyPrompt,
} from '../personalAccessKeyPrompt.js';
import { promptUser } from '../promptUtils.js';
import { uiInfoSection } from '../../ui/index.js';
import { uiLogger } from '../../ui/logger.js';
import { PromptExitError } from '../../errors/PromptExitError.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { lib } from '../../../lang/en.js';

vi.mock('open');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/urls');
vi.mock('../promptUtils');
vi.mock('../../ui/index');

const mockedOpen = vi.mocked(open);
const mockedDeleteConfigFileIfEmpty = vi.mocked(deleteConfigFileIfEmpty);
const mockedGetHubSpotWebsiteOrigin = vi.mocked(getHubSpotWebsiteOrigin);
const mockedPromptUser = vi.mocked(promptUser);
const mockedUiInfoSection = vi.mocked(uiInfoSection);

const WEBSITE_ORIGIN = 'https://app.hubspot.com';
const ENV = 'qa';
const { OPEN_BROWSER, PASTE_EXISTING } =
  lib.prompts.personalAccessKeyPrompt.personalAccessKeyPromptChoices;

type ValidateFn = (value?: unknown) => unknown;
type TransformerFn = (value?: string) => string | undefined;

function getPromptConfig(promptName: string): {
  validate?: ValidateFn;
  transformer?: TransformerFn;
  [key: string]: unknown;
} {
  const config = OAUTH_FLOW.find(prompt => prompt.name === promptName);
  return config as unknown as ReturnType<typeof getPromptConfig>;
}

function getPersonalAccessKeyPromptConfig(): {
  validate: ValidateFn;
  transformer: TransformerFn;
  message: string;
} {
  const [config] = mockedPromptUser.mock.calls.at(-1)!;
  return config as unknown as ReturnType<
    typeof getPersonalAccessKeyPromptConfig
  >;
}

describe('lib/prompts/personalAccessKeyPrompt', () => {
  beforeEach(() => {
    vi.stubEnv('BROWSER', '');
    mockedGetHubSpotWebsiteOrigin.mockReturnValue(WEBSITE_ORIGIN);
    mockedPromptUser.mockResolvedValue({ personalAccessKey: 'pak-value' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('personalAccessKeyPrompt()', () => {
    it('should return the personal access key', async () => {
      const result = await personalAccessKeyPrompt();

      expect(result).toBe('pak-value');
    });

    it('should prompt for the personal access key without opening the browser', async () => {
      await personalAccessKeyPrompt();

      expect(mockedPromptUser).toHaveBeenCalledTimes(1);
      expect(getPersonalAccessKeyPromptConfig().message).toBe(
        lib.prompts.personalAccessKeyPrompt.enterPersonalAccessKey
      );
      expect(mockedOpen).not.toHaveBeenCalled();
    });

    describe('personal access key validate', () => {
      beforeEach(async () => {
        await personalAccessKeyPrompt();
      });

      it('should return the invalid key error when the value is empty', () => {
        expect(getPersonalAccessKeyPromptConfig().validate('')).toBe(
          lib.prompts.personalAccessKeyPrompt.errors.invalidPersonalAccessKey
        );
      });

      it('should return the invalid key error when the value is not a string', () => {
        expect(getPersonalAccessKeyPromptConfig().validate(123)).toBe(
          lib.prompts.personalAccessKeyPrompt.errors.invalidPersonalAccessKey
        );
      });

      it('should return the copy error when the value starts with a bullet', () => {
        expect(getPersonalAccessKeyPromptConfig().validate('•••••')).toBe(
          lib.prompts.personalAccessKeyPrompt.errors
            .invalidPersonalAccessKeyCopy
        );
      });

      it('should return true when the value is a valid key', () => {
        expect(getPersonalAccessKeyPromptConfig().validate('pak-value')).toBe(
          true
        );
      });
    });

    describe('personal access key transformer', () => {
      beforeEach(async () => {
        await personalAccessKeyPrompt();
      });

      it('should mask every character with an asterisk', () => {
        expect(getPersonalAccessKeyPromptConfig().transformer('abcd')).toBe(
          '****'
        );
      });

      it('should return an empty value unchanged', () => {
        expect(getPersonalAccessKeyPromptConfig().transformer('')).toBe('');
        expect(getPersonalAccessKeyPromptConfig().transformer(undefined)).toBe(
          undefined
        );
      });
    });
  });

  describe('legacyPersonalAccessKeyPrompt()', () => {
    beforeEach(() => {
      mockedPromptUser
        .mockResolvedValueOnce({
          personalAccessKeyBrowserOpenPrep: OPEN_BROWSER,
        })
        .mockResolvedValueOnce({ personalAccessKey: 'pak-value' });
    });

    it('should return the personal access key and env', async () => {
      const result = await legacyPersonalAccessKeyPrompt({ env: ENV });

      expect(result).toEqual({ personalAccessKey: 'pak-value', env: ENV });
    });

    it('should look up the website origin for the env', async () => {
      await legacyPersonalAccessKeyPrompt({ env: ENV });

      expect(mockedGetHubSpotWebsiteOrigin).toHaveBeenCalledWith(ENV);
    });

    it('should show the setup info section', async () => {
      await legacyPersonalAccessKeyPrompt({ env: ENV });

      expect(mockedUiInfoSection).toHaveBeenCalledWith(
        lib.prompts.personalAccessKeyPrompt.personalAccessKeySetupTitle,
        expect.any(Function)
      );
    });

    it('should log the browser open prep message inside the info section', async () => {
      mockedUiInfoSection.mockImplementation((_title, callback) => callback());

      await legacyPersonalAccessKeyPrompt({ env: ENV });

      expect(uiLogger.log).toHaveBeenCalledWith(
        lib.prompts.personalAccessKeyPrompt.personalAccessKeyBrowserOpenPrep
      );
    });

    it('should prompt for how to authenticate with the choices defaulting to opening the browser', async () => {
      await legacyPersonalAccessKeyPrompt({ env: ENV });

      expect(mockedPromptUser).toHaveBeenNthCalledWith(1, [
        expect.objectContaining({
          name: 'personalAccessKeyBrowserOpenPrep',
          type: 'list',
          choices: [OPEN_BROWSER, PASTE_EXISTING],
          default: OPEN_BROWSER,
        }),
      ]);
    });

    it('should open the generic personal access key url when the user chooses to open the browser', async () => {
      await legacyPersonalAccessKeyPrompt({ env: ENV });

      expect(mockedOpen).toHaveBeenCalledWith(
        `${WEBSITE_ORIGIN}/l/personal-access-key`,
        { url: true }
      );
      expect(uiLogger.log).toHaveBeenCalledWith(
        lib.prompts.personalAccessKeyPrompt.logs.openingWebBrowser(
          `${WEBSITE_ORIGIN}/l/personal-access-key`
        )
      );
    });

    it('should open the account specific url when an account is provided', async () => {
      await legacyPersonalAccessKeyPrompt({ env: ENV, account: 123 });

      expect(mockedOpen).toHaveBeenCalledWith(
        `${WEBSITE_ORIGIN}/personal-access-key/123`,
        { url: true }
      );
    });

    it('should not open the browser when the user chooses to paste an existing key', async () => {
      mockedPromptUser.mockReset();
      mockedPromptUser
        .mockResolvedValueOnce({
          personalAccessKeyBrowserOpenPrep: PASTE_EXISTING,
        })
        .mockResolvedValueOnce({ personalAccessKey: 'pak-value' });

      const result = await legacyPersonalAccessKeyPrompt({ env: ENV });

      expect(mockedOpen).not.toHaveBeenCalled();
      expect(result).toEqual({ personalAccessKey: 'pak-value', env: ENV });
    });

    it('should delete the empty config file and throw a PromptExitError when no choice is made', async () => {
      mockedPromptUser.mockReset();
      mockedPromptUser.mockResolvedValueOnce({
        personalAccessKeyBrowserOpenPrep: '',
      });

      const promise = legacyPersonalAccessKeyPrompt({ env: ENV });

      await expect(promise).rejects.toThrow(PromptExitError);
      await expect(promise).rejects.toMatchObject({
        message: lib.prompts.personalAccessKeyPrompt.errors.authCancelled,
        exitCode: EXIT_CODES.SUCCESS,
      });
      expect(mockedDeleteConfigFileIfEmpty).toHaveBeenCalled();
    });

    describe('when the BROWSER env var is none', () => {
      beforeEach(() => {
        vi.stubEnv('BROWSER', 'none');
        mockedPromptUser.mockReset();
        mockedPromptUser.mockResolvedValue({ personalAccessKey: 'pak-value' });
      });

      it('should skip the browser menu and only prompt for the key', async () => {
        const result = await legacyPersonalAccessKeyPrompt({ env: ENV });

        expect(result).toEqual({ personalAccessKey: 'pak-value', env: ENV });
        expect(mockedPromptUser).toHaveBeenCalledTimes(1);
        expect(mockedUiInfoSection).not.toHaveBeenCalled();
        expect(mockedOpen).not.toHaveBeenCalled();
      });
    });
  });

  describe('OAUTH_FLOW', () => {
    it('should prompt for the account name, account id, client id, client secret and scopes in order', () => {
      expect(OAUTH_FLOW.map(prompt => prompt.name)).toEqual([
        'name',
        'accountId',
        'clientId',
        'clientSecret',
        'scopes',
      ]);
    });

    describe('accountId validate', () => {
      const { validate } = getPromptConfig('accountId');

      it('should return the invalid account id error when the value is not positive', () => {
        expect(validate!(0)).toBe(
          lib.prompts.personalAccessKeyPrompt.errors.invalidAccountId
        );
      });

      it('should return the invalid account id error when the value is NaN', () => {
        expect(validate!(NaN)).toBe(
          lib.prompts.personalAccessKeyPrompt.errors.invalidAccountId
        );
      });

      it('should return the invalid account id error when the value is undefined', () => {
        expect(validate!(undefined)).toBe(
          lib.prompts.personalAccessKeyPrompt.errors.invalidAccountId
        );
      });

      it('should return true when the value is a positive number', () => {
        expect(validate!(123)).toBe(true);
      });
    });

    describe('clientId validate', () => {
      const { validate } = getPromptConfig('clientId');

      it('should return the invalid client id error when the value is not a string', () => {
        expect(validate!(undefined)).toBe(
          lib.prompts.personalAccessKeyPrompt.errors.invalidOauthClientId
        );
      });

      it('should return the length error when the value is not 36 characters', () => {
        expect(validate!('short')).toBe(
          lib.prompts.personalAccessKeyPrompt.errors.invalidOauthClientIdLength
        );
      });

      it('should return true when the value is 36 characters', () => {
        expect(validate!('a'.repeat(36))).toBe(true);
      });
    });

    describe('clientSecret validate', () => {
      const { validate } = getPromptConfig('clientSecret');

      it('should return the invalid client secret error when the value is not a string', () => {
        expect(validate!(undefined)).toBe(
          lib.prompts.personalAccessKeyPrompt.errors.invalidOauthClientSecret
        );
      });

      it('should return the length error when the value is not 36 characters', () => {
        expect(validate!('short')).toBe(
          lib.prompts.personalAccessKeyPrompt.errors
            .invalidOauthClientSecretLength
        );
      });

      it('should return the copy error when the value starts with an asterisk', () => {
        expect(validate!(`*${'a'.repeat(35)}`)).toBe(
          lib.prompts.personalAccessKeyPrompt.errors
            .invalidOauthClientSecretCopy
        );
      });

      it('should return true when the value is 36 characters', () => {
        expect(validate!('a'.repeat(36))).toBe(true);
      });
    });

    describe('scopes', () => {
      it('should be a checkbox of the oauth scopes defaulting to the default scopes', () => {
        expect(getPromptConfig('scopes')).toEqual(
          expect.objectContaining({
            type: 'checkbox',
            message: lib.prompts.personalAccessKeyPrompt.selectScopes,
            default: [...DEFAULT_OAUTH_SCOPES],
            choices: [...OAUTH_SCOPES],
          })
        );
      });
    });
  });
});
