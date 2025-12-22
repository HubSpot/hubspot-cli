import { Arguments } from 'yargs';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import * as projectsConfig from '../../projects/config.js';
import { performChecks } from '../yargsChecksMiddleware.js';
import { uiLogger } from '../../ui/logger.js';
import { commands } from '../../../lang/en.js';

vi.mock('../../ui/logger', () => ({
  uiLogger: {
    error: vi.fn(),
  },
}));
vi.mock('../../projects/config');

const getIsInProjectSpy = vi.spyOn(projectsConfig, 'getIsInProject');
const processExitSpy = vi.spyOn(process, 'exit');

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
      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.generalErrors.srcIsProject(argv.src!, argv._.toString())
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
      expect(uiLogger.error).not.toHaveBeenCalled();
    });
  });
});
