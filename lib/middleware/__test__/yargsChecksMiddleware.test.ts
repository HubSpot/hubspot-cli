import { Arguments } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { EXIT_CODES } from '../../enums/exitCodes';
import * as projects from '../../projects';
import { performChecks } from '../yargsChecksMiddleware';

jest.mock('@hubspot/local-dev-lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));
jest.mock('../../projects');
jest.mock('../../lang', () => ({
  i18n: jest.fn(key => key),
}));

const getIsInProjectSpy = jest.spyOn(projects, 'getIsInProject');
const processExitSpy = jest.spyOn(process, 'exit');

describe('lib/middleware/yargsChecksMiddleware', () => {
  beforeEach(() => {
    processExitSpy.mockImplementation(code => {
      throw new Error(`Process.exit called with code ${code}`);
    });
  });

  describe('performChecks()', () => {
    it('should exit with error when running upload/watch inside a project', () => {
      const argv: Arguments<{ src?: string }> = {
        _: ['upload'],
        src: './project',
        $0: 'hs',
      };

      getIsInProjectSpy.mockReturnValue(true);

      expect(() => performChecks(argv)).toThrow();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        'commands.generalErrors.srcIsProject'
      );
    });

    it('should return true when no checks fail', () => {
      const argv: Arguments<{ src?: string }> = {
        _: ['upload'],
        src: './not-a-project',
        $0: 'hs',
      };

      getIsInProjectSpy.mockReturnValue(false);

      expect(performChecks(argv)).toBe(true);
      expect(processExitSpy).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
