import { EXIT_CODES } from '../../lib/enums/exitCodes';

import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import doctorCommand, { DoctorArgs } from '../doctor';
import { trackCommandUsage } from '../../lib/usageTracking';
import { Doctor } from '../../lib/doctor/Doctor';
import { logger } from '@hubspot/local-dev-lib/logger';
import __fs from 'fs';
import { getCwd as __getCwd } from '@hubspot/local-dev-lib/path';

jest.mock('../../lib/usageTracking');
jest.mock('../../lib/doctor/Doctor');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('@hubspot/local-dev-lib/path');
jest.mock('yargs');

const DoctorMock = Doctor as jest.MockedClass<typeof Doctor>;
const fs = __fs as jest.Mocked<typeof __fs>;
const getCwd = __getCwd as jest.MockedFunction<typeof __getCwd>;

const optionSpy = jest
  .spyOn(yargs as Argv, 'option')
  .mockReturnValue(yargs as Argv);

const date = new Date('2022-02-22');

jest.useFakeTimers().setSystemTime(date);

describe('doctor', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: jest.SpyInstance;
  const accountId = 123456;

  beforeEach(() => {
    // @ts-expect-error Doesn't match the actual signature because then the linter complains about unused variables
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  describe('command', () => {
    it('should have the proper command name', () => {
      expect(doctorCommand.command).toEqual('doctor');
    });
  });

  describe('describe', () => {
    it('should have a description', () => {
      expect(doctorCommand.describe).toEqual(
        'Retrieve diagnostic information about your local HubSpot configurations.'
      );
    });
  });

  describe('builder', () => {
    it('should apply the correct options', () => {
      doctorCommand.builder(yargs as Argv);
      expect(optionSpy).toHaveBeenCalledWith('output-dir', {
        describe: 'Directory to save a detailed diagnosis JSON file in',
        type: 'string',
      });
    });
  });

  describe('handler', () => {
    let diagnosis: string;

    beforeEach(() => {
      diagnosis = 'Yooooooooooooooo';
      DoctorMock.mockImplementation(() => {
        return {
          diagnose: jest.fn().mockResolvedValue({ diagnosis }),
          accountId,
        } as unknown as Doctor;
      });
    });

    it('should track the command usage', async () => {
      await doctorCommand.handler({} as ArgumentsCamelCase<DoctorArgs>);
      expect(trackCommandUsage).toHaveBeenCalledTimes(1);
      expect(trackCommandUsage).toHaveBeenCalledWith(
        'doctor',
        undefined,
        accountId
      );
    });

    it('should log the diagnosis if it is defined', async () => {
      await doctorCommand.handler({} as ArgumentsCamelCase<DoctorArgs>);
      expect(logger.log).toHaveBeenCalledTimes(1);
      expect(logger.log).toHaveBeenCalledWith(diagnosis);

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should log an error if the diagnosis is undefined', async () => {
      DoctorMock.mockImplementationOnce(() => {
        return {
          diagnose: jest.fn().mockResolvedValue(undefined),
          accountId,
        } as unknown as Doctor;
      });
      await doctorCommand.handler({} as ArgumentsCamelCase<DoctorArgs>);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('Error generating diagnosis');

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should write the output to a file if output-dir is defined', async () => {
      const writeFileSpy = jest
        .spyOn(fs, 'writeFileSync')
        .mockImplementationOnce(() => {});
      const expectedOutputFile = `/foo/hubspot-doctor-${date.toISOString()}.json`;
      await doctorCommand.handler({
        outputDir: '/foo',
      } as ArgumentsCamelCase<DoctorArgs>);

      expect(logger.log).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();

      expect(writeFileSpy).toHaveBeenCalledTimes(1);
      expect(writeFileSpy).toHaveBeenCalledWith(
        expectedOutputFile,
        expect.stringContaining(diagnosis)
      );

      expect(logger.success).toHaveBeenCalledTimes(1);
      expect(logger.success).toHaveBeenCalledWith(
        expect.stringMatching(/Output written to /)
      );

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle absolute paths', async () => {
      const writeFileSpy = jest
        .spyOn(fs, 'writeFileSync')
        .mockImplementationOnce(() => {});
      const cwd = '/some/path/to';
      getCwd.mockImplementationOnce(() => cwd);

      const expectedOutputFile = `${cwd}/foo/hubspot-doctor-${date.toISOString()}.json`;
      await doctorCommand.handler({
        outputDir: './foo',
      } as ArgumentsCamelCase<DoctorArgs>);

      expect(logger.log).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();

      expect(writeFileSpy).toHaveBeenCalledTimes(1);
      expect(writeFileSpy).toHaveBeenCalledWith(
        expectedOutputFile,
        expect.stringContaining(diagnosis)
      );

      expect(logger.success).toHaveBeenCalledTimes(1);
      expect(logger.success).toHaveBeenCalledWith(
        expect.stringMatching(/Output written to /)
      );

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should log an error message when writing the output fails', async () => {
      const errorMessage = 'Something bad happened';
      const writeFileSpy = jest
        .spyOn(fs, 'writeFileSync')
        .mockImplementationOnce(() => {
          throw new Error(errorMessage);
        });

      await doctorCommand.handler({
        outputDir: '/foo',
      } as ArgumentsCamelCase<DoctorArgs>);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/Unable to write output to/)
      );

      expect(writeFileSpy).toHaveBeenCalledTimes(1);
      expect(writeFileSpy).toHaveBeenCalledWith(
        `/foo/hubspot-doctor-${date.toISOString()}.json`,
        expect.stringContaining(diagnosis)
      );

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
