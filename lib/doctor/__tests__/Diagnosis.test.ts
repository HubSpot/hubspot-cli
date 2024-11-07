import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';

jest.mock('@hubspot/local-dev-lib/config');

import { Diagnosis } from '../Diagnosis';
import { DiagnosticInfo } from '../DiagnosticInfoBuilder';
import { getAccountConfig as __getAccountConfig } from '@hubspot/local-dev-lib/config';
import stripAnsi from 'strip-ansi';

const getAccountConfig = __getAccountConfig as jest.MockedFunction<
  typeof __getAccountConfig
>;

describe('lib/doctor/Diagnosis', () => {
  const diagnosticInfo: DiagnosticInfo = {
    account: {},
    arch: process.arch,
    config: 'path/to/config.json',
    configFiles: [],
    envFiles: [],
    files: [],
    jsonFiles: [],
    packageFiles: [],
    packageLockFiles: [],
    platform: process.platform,
    project: {
      config: {
        projectDir: 'project-dir',
        projectConfig: {
          name: 'Super cool project',
        },
      },
    },
    versions: { '@hubspot/cli': '123', node: '18.0.1', npm: '8.0.0' },
  };

  const accountId = 123456;

  beforeEach(() => {
    getAccountConfig.mockReturnValue({
      accountType: 'STANDARD',
      name: 'Standard Account',
    } as CLIAccount);
  });

  describe('toString', () => {
    it('should return an empty diagnosis when no sections have been added', () => {
      const diagnosis = new Diagnosis({ diagnosticInfo, accountId });
      const output = diagnosis.toString();
      expect(output).toEqual('');
    });

    it('should generate the diagnosis output', () => {
      const diagnosis = new Diagnosis({ diagnosticInfo, accountId });

      const cliMessage = 'Important CLI Message';
      const cliSecondaryMessage = 'The CLI Section is Showing';

      diagnosis.addCliSection({
        type: 'success',
        message: cliMessage,
        secondaryMessaging: cliSecondaryMessage,
      });

      const cliConfigMessage = 'Important CLI Config Message';
      const cliConfigSecondaryMessage = 'The CLI Config Section is Showing';

      diagnosis.addCLIConfigSection({
        type: 'error',
        message: cliConfigMessage,
        secondaryMessaging: cliConfigSecondaryMessage,
      });

      const projectMessage = 'Important Project Message';
      const projectSecondaryMessage = 'The Project Section is Showing';

      diagnosis.addProjectSection({
        type: 'warning',
        message: projectMessage,
        secondaryMessaging: projectSecondaryMessage,
      });

      expect(stripAnsi(diagnosis.toString())).toMatchSnapshot();
    });

    it('should generate categories that have sections', () => {
      const diagnosis = new Diagnosis({ diagnosticInfo, accountId });

      const cliMessage = 'Important CLI Message';
      const cliSecondaryMessage = 'The CLI Section is Showing';

      diagnosis.addCliSection({
        type: 'success',
        message: cliMessage,
        secondaryMessaging: cliSecondaryMessage,
      });

      expect(stripAnsi(diagnosis.toString())).toMatchSnapshot();
    });
  });
});
