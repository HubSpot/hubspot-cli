const {
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('@hubspot/cms-lib/lib/constants');
const { authenticateWithOauth } = require('@hubspot/cms-lib/oauth');
const {
  personalAccessKeyPrompt,
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cms-lib/personalAccessKey');
const { promptUser } = require('../../lib/prompts');
const { configureAuthCommand } = require('../auth');

jest.mock('../../lib/prompts');
jest.mock('@hubspot/cms-lib/oauth');
jest.mock('@hubspot/cms-lib/personalAccessKey');
jest.spyOn(process, 'exit').mockImplementation(() => {});

promptUser.mockResolvedValue({
  portalId: 123,
  clientId: 'fakeClientId',
  clientSecret: 'fakeClientSecret',
});

personalAccessKeyPrompt.mockResolvedValue({
  personalAccessKey:
    'CJDVnLanLRICEQIYyLu8LyDh9E4opf1GMhkAxGuU5XN_O2O2QhX0khw7cwIkPkBRHye-OfIADgLBAAADAIADAAAAAAAAAAJCGQC8a5TlhtSU8T-2mVLxOBpxS18aM42oGKk',
});

const mockedProgramActionGetter = actionCallback => {
  const mockedProgram = {
    version: () => {
      return mockedProgram;
    },
    description: () => {
      return mockedProgram;
    },
    arguments: () => {
      return mockedProgram;
    },
    option: () => {
      return mockedProgram;
    },
    on: () => {
      return mockedProgram;
    },
    action: actionMethod => {
      actionCallback(actionMethod);
    },
  };

  return mockedProgram;
};

describe('auth command', () => {
  describe(`${OAUTH_AUTH_METHOD.value} auth method`, () => {
    let authAction;
    beforeEach(() => {
      const mockedProgram = mockedProgramActionGetter(actionMethod => {
        authAction = actionMethod;
      });
      configureAuthCommand(mockedProgram);
      authAction(OAUTH_AUTH_METHOD.value, {});
    });
    it(`calls promptUser when doing auth with type ${OAUTH_AUTH_METHOD.value}`, () => {
      expect(promptUser).toHaveBeenCalled();
    });
    it(`calls authenticateWithOauth when doing auth with type ${OAUTH_AUTH_METHOD.value}`, () => {
      expect(authenticateWithOauth).toHaveBeenCalled();
    });
  });

  describe(`${PERSONAL_ACCESS_KEY_AUTH_METHOD.value} auth method`, () => {
    let authAction;
    beforeEach(() => {
      const mockedProgram = mockedProgramActionGetter(actionMethod => {
        authAction = actionMethod;
      });
      configureAuthCommand(mockedProgram);
      authAction(PERSONAL_ACCESS_KEY_AUTH_METHOD.value, {});
    });
    it(`calls promptUser when doing auth with type ${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}`, () => {
      expect(personalAccessKeyPrompt).toHaveBeenCalled();
    });
    it(`calls authenticateWithOauth when doing auth with type ${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}`, () => {
      expect(updateConfigWithPersonalAccessKey).toHaveBeenCalled();
    });
  });
});
