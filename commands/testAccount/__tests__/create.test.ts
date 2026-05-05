import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addTestingOptions,
  addJSONOutputOptions,
} from '../../../lib/commonOpts.js';
import testAccountCreateCommand from '../create.js';
import {
  ACCOUNT_LEVEL_CHOICES,
  ACCOUNT_LEVELS,
} from '../../../lib/constants.js';

vi.mock('../../../lib/commonOpts');

describe('commands/testAccount/create', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(testAccountCreateCommand.command).toEqual('create');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(testAccountCreateCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      testAccountCreateCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);

      expect(addJSONOutputOptions).toHaveBeenCalledTimes(1);
      expect(addJSONOutputOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should add account-name option', () => {
      testAccountCreateCommand.builder(yargsMock);

      expect(yargsMock.option).toHaveBeenCalledWith('name', {
        type: 'string',
        description: 'Name for the test account',
      });
    });

    it('should add description option', () => {
      testAccountCreateCommand.builder(yargsMock);

      expect(yargsMock.option).toHaveBeenCalledWith('description', {
        type: 'string',
        description: 'Description for the test account',
      });
    });

    it('should add hub level options', () => {
      testAccountCreateCommand.builder(yargsMock);

      expect(yargsMock.option).toHaveBeenCalledWith('marketing-level', {
        type: 'string',
        description:
          'Marketing Hub tier. Options: FREE, STARTER, PROFESSIONAL, ENTERPRISE',
        choices: ACCOUNT_LEVEL_CHOICES,
      });

      expect(yargsMock.option).toHaveBeenCalledWith('ops-level', {
        type: 'string',
        description:
          'Operations Hub tier. Options: FREE, STARTER, PROFESSIONAL, ENTERPRISE',
        choices: ACCOUNT_LEVEL_CHOICES,
      });

      expect(yargsMock.option).toHaveBeenCalledWith('service-level', {
        type: 'string',
        description:
          'Service Hub tier. Options: FREE, STARTER, PROFESSIONAL, ENTERPRISE',
        choices: ACCOUNT_LEVEL_CHOICES,
      });

      expect(yargsMock.option).toHaveBeenCalledWith('sales-level', {
        type: 'string',
        description:
          'Sales Hub tier. Options: FREE, STARTER, PROFESSIONAL, ENTERPRISE',
        choices: ACCOUNT_LEVEL_CHOICES,
      });

      expect(yargsMock.option).toHaveBeenCalledWith('content-level', {
        type: 'string',
        description:
          'Content Hub tier. Options: FREE, STARTER, PROFESSIONAL, ENTERPRISE',
        choices: ACCOUNT_LEVEL_CHOICES,
      });

      expect(yargsMock.option).toHaveBeenCalledWith('commerce-level', {
        type: 'string',
        description:
          'Commerce Hub tier. Options: FREE, PROFESSIONAL, ENTERPRISE',
        choices: ACCOUNT_LEVEL_CHOICES.filter(
          level => level !== ACCOUNT_LEVELS.STARTER
        ),
      });
    });

    it('should add examples for all usage scenarios', () => {
      testAccountCreateCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledWith([
        [
          '$0 test-account create',
          'Interactive mode - prompts for all options',
        ],
        [
          '$0 test-account create --name "MyTestAccount"',
          'Provide name via flag, prompt for description and tier selection',
        ],
        [
          '$0 test-account create --name "MyTestAccount" --description "Test account"',
          'Provide name and description, prompt for tier selection',
        ],
        [
          '$0 test-account create --name "MyTestAccount" --marketing-level PROFESSIONAL',
          'Specify marketing tier, other tiers default to ENTERPRISE',
        ],
        [
          '$0 test-account create --config-path ./test-account-config.json',
          'Create from config file (mutually exclusive with other flags)',
        ],
      ]);
    });
  });
});
